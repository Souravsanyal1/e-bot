import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

import { config, isAdmin } from './config.js';
import { initDatabase, db } from './db/index.js';
import { initRedis, cache } from './redis.js';
import { initBot, broadcastMessage } from './bot.js';
import { firestoreDB } from './firebase.js';
import { calculateMiningState, startMiningSession, claimMiningSession } from './services/mining.js';
import { getTasksForUser, completeTask } from './services/tasks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: false });

// Helper to validate Telegram initData
function validateTelegramInitData(initData) {
  if (!initData) return null;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return null;

    urlParams.delete('hash');
    const params = Array.from(urlParams.entries())
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');

    // If bot token is not configured or in dev testing, parse user directly
    if (!config.BOT_TOKEN || config.BOT_TOKEN.includes('123456:ABC')) {
      const userStr = urlParams.get('user');
      return userStr ? JSON.parse(userStr) : null;
    }

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(params).digest('hex');

    if (calculatedHash === hash) {
      const userStr = urlParams.get('user');
      return userStr ? JSON.parse(userStr) : null;
    }
  } catch (err) {
    console.error('Validation error:', err.message);
  }
  return null;
}

// User extraction helper from request headers or body
function extractUserFromRequest(req) {
  const initData = req.headers['x-telegram-init-data'] || req.body?.initData;
  const devUserId = req.headers['x-dev-user-id'] || req.query?.dev_user_id;

  // Telegram validation
  if (initData) {
    const tgUser = validateTelegramInitData(initData);
    if (tgUser) return tgUser;
  }

  // Development bypass when running outside Telegram in browser
  if (devUserId || process.env.NODE_ENV !== 'production') {
    return {
      id: parseInt(devUserId || '999888777', 10),
      first_name: 'E-FORCE Miner',
      username: 'eforce_master',
      is_dev: true
    };
  }

  return null;
}

async function startServer() {
  await initDatabase();
  await initRedis();
  initBot();

  // Allow empty body for POST requests with application/json header
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    try {
      const json = body && body.trim().length > 0 ? JSON.parse(body) : {};
      done(null, json);
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data', 'x-dev-user-id']
  });

  // Serve frontend build & static media from frontend/dist
  const distDir = path.join(__dirname, '../frontend/dist');
  await fastify.register(fastifyStatic, {
    root: distDir,
    prefix: '/',
  });

  fastify.setNotFoundHandler(async (req, reply) => {
    if (req.raw.url && req.raw.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'API endpoint not found' });
    }
    return reply.sendFile('index.html');
  });

  // --- API ROUTES ---

  // Health check
  fastify.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    postgres: db.isPostgres(),
    appName: 'E-FORCE 24H Mining'
  }));

  // User Sync & Initialization
  fastify.post('/api/user/sync', async (req, reply) => {
    const user = extractUserFromRequest(req);
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized. Valid Telegram session required.' });
    }

    const { referrerId } = req.body || {};

    let dbUser = await db.get('SELECT * FROM users WHERE id = $1', [user.id]);
    if (!dbUser) {
      // Register
      const validRef = (referrerId && Number(referrerId) !== user.id) ? Number(referrerId) : null;
      await db.run(`
        INSERT INTO users (id, username, first_name, last_name, balance, speed_per_hr, referred_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [user.id, user.username || '', user.first_name || '', user.last_name || '', 0.0, config.BASE_MINING_RATE, validRef]);

      // Sync to Cloud Firestore
      try {
        await firestoreDB.setUser(user.id, {
          username: user.username || '',
          first_name: user.first_name || 'Miner',
          last_name: user.last_name || '',
          balance: 0.0,
          speed_per_hr: config.BASE_MINING_RATE,
          referral_count: 0,
          referred_by: validRef,
          is_banned: false
        });
      } catch (fErr) {
        console.warn('Firestore sync error:', fErr.message);
      }

      // If valid referrer, reward them
      if (validRef) {
        const ref = await db.get('SELECT * FROM users WHERE id = $1', [validRef]);
        if (ref) {
          const newSpeed = Number(ref.speed_per_hr || config.BASE_MINING_RATE) + config.REFERRAL_SPEED_BOOST;
          const newBal = Number(ref.balance || 0) + config.REFERRAL_COIN_BONUS;
          await db.run('UPDATE users SET referral_count = referral_count + 1, speed_per_hr = $1, balance = $2 WHERE id = $3', [newSpeed, newBal, validRef]);
          await db.run('INSERT INTO referrals (referrer_id, referred_id, bonus_coins, speed_boost) VALUES ($1, $2, $3, $4)', [validRef, user.id, config.REFERRAL_COIN_BONUS, config.REFERRAL_SPEED_BOOST]);

          try {
            await firestoreDB.setUser(validRef, {
              referral_count: (ref.referral_count || 0) + 1,
              speed_per_hr: newSpeed,
              balance: newBal
            });
            await firestoreDB.addReferral(validRef, user.id, config.REFERRAL_COIN_BONUS, config.REFERRAL_SPEED_BOOST);
          } catch (fErr) {
            console.warn('Firestore referral sync error:', fErr.message);
          }
        }
      }

      dbUser = await db.get('SELECT * FROM users WHERE id = $1', [user.id]);
    }

    const miningState = calculateMiningState(dbUser);
    const userIsAdmin = isAdmin(user.id);

    return {
      user: {
        id: dbUser.id,
        username: dbUser.username,
        first_name: dbUser.first_name,
        balance: Number(dbUser.balance),
        speed_per_hr: Number(dbUser.speed_per_hr),
        referral_count: Number(dbUser.referral_count || 0),
        is_admin: userIsAdmin
      },
      mining: miningState,
      config: {
        base_rate: config.BASE_MINING_RATE,
        session_duration_hours: config.SESSION_DURATION_HOURS,
        referral_speed_boost: config.REFERRAL_SPEED_BOOST,
        adsgram_block_id: config.ADSGRAM_BLOCK_ID
      }
    };
  });

  // Start 24H Mining Session
  fastify.post('/api/mining/start', async (req, reply) => {
    const user = extractUserFromRequest(req);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const miningState = await startMiningSession(user.id);
      return { success: true, mining: miningState };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Claim Mined E-FORCE
  fastify.post('/api/mining/claim', async (req, reply) => {
    const user = extractUserFromRequest(req);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const result = await claimMiningSession(user.id);
      return { success: true, ...result };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Get Mining Status
  fastify.get('/api/mining/status', async (req, reply) => {
    const user = extractUserFromRequest(req);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const dbUser = await db.get('SELECT * FROM users WHERE id = $1', [user.id]);
    if (!dbUser) return reply.code(404).send({ error: 'User not found' });

    const miningState = calculateMiningState(dbUser);
    return { mining: miningState, balance: Number(dbUser.balance) };
  });

  // Tasks List
  fastify.get('/api/tasks', async (req, reply) => {
    const user = extractUserFromRequest(req);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const tasks = await getTasksForUser(user.id);
    return tasks;
  });

  // Complete Task & Gain Speed Boost
  fastify.post('/api/tasks/complete', async (req, reply) => {
    const user = extractUserFromRequest(req);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { taskId } = req.body || {};
    if (!taskId) return reply.code(400).send({ error: 'taskId is required' });

    try {
      const result = await completeTask(user.id, taskId);
      return { success: true, ...result };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Referrals Status & List
  fastify.get('/api/referrals', async (req, reply) => {
    const user = extractUserFromRequest(req);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const dbUser = await db.get('SELECT * FROM users WHERE id = $1', [user.id]);
    const friends = await db.all(`
      SELECT r.bonus_coins, r.speed_boost, r.created_at, u.first_name, u.username, u.balance
      FROM referrals r
      JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = $1
      ORDER BY r.created_at DESC
      LIMIT 100
    `, [user.id]);

    const botUsername = config.BOT_USERNAME || 'Elite_Force_Official_Mining_bot';
    const referralLink = `https://t.me/${botUsername}?start=ref_${user.id}`;
    const totalBoost = Number((dbUser.referral_count || 0) * config.REFERRAL_SPEED_BOOST).toFixed(2);

    return {
      referral_link: referralLink,
      total_invited: dbUser.referral_count || 0,
      speed_boost_earned: Number(totalBoost),
      bonus_per_friend: config.REFERRAL_COIN_BONUS,
      boost_per_friend: config.REFERRAL_SPEED_BOOST,
      friends: friends.map(f => ({
        name: f.first_name || f.username || 'Anonymous Miner',
        username: f.username,
        joined_at: f.created_at,
        bonus_coins: Number(f.bonus_coins),
        speed_boost: Number(f.speed_boost)
      }))
    };
  });

  // Leaderboard
  fastify.get('/api/leaderboard', async () => {
    // Check cached top users or query db
    const topUsers = await db.all(`
      SELECT id, username, first_name, balance, speed_per_hr, referral_count
      FROM users
      WHERE is_banned = 0 OR is_banned IS FALSE
      ORDER BY balance DESC
      LIMIT 50
    `);

    return {
      topMiners: topUsers.map((u, index) => ({
        rank: index + 1,
        id: u.id,
        name: u.first_name || u.username || `Miner #${String(u.id).slice(-4)}`,
        balance: Number(Number(u.balance).toFixed(2)),
        speed: Number(Number(u.speed_per_hr).toFixed(2)),
        referrals: u.referral_count || 0
      }))
    };
  });

  // --- ADMIN PROTECTED ROUTES ---

  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/admin')) {
      const user = extractUserFromRequest(req);
      if (!user || !isAdmin(user.id)) {
        return reply.code(403).send({ error: 'Access denied: Administrator privileges required.' });
      }
    }
  });

  // Admin: Overall Stats
  fastify.get('/api/admin/stats', async () => {
    const totalUsers = (await db.get('SELECT COUNT(*) as count FROM users')).count;
    const totalMined = (await db.get('SELECT SUM(balance) as total FROM users')).total || 0;
    const activeTasks = (await db.get('SELECT COUNT(*) as count FROM tasks WHERE is_active = 1 OR is_active IS TRUE')).count;
    const completedTasks = (await db.get('SELECT COUNT(*) as count FROM user_tasks')).count;
    const totalReferrals = (await db.get('SELECT COUNT(*) as count FROM referrals')).count;

    return {
      totalUsers: Number(totalUsers),
      totalMinedTokens: Number(Number(totalMined).toFixed(2)),
      activeTasks: Number(activeTasks),
      completedTasks: Number(completedTasks),
      totalReferrals: Number(totalReferrals)
    };
  });

  // Admin: Get all tasks
  fastify.get('/api/admin/tasks', async () => {
    return await db.all('SELECT * FROM tasks ORDER BY id DESC');
  });

  // Admin: Create Task
  fastify.post('/api/admin/tasks', async (req) => {
    const { title, description, reward_coins, speed_boost, task_type, action_type, link, channel_username, ad_required, wait_time_sec } = req.body;
    await db.run(`
      INSERT INTO tasks (title, description, reward_coins, speed_boost, task_type, action_type, link, channel_username, ad_required, wait_time_sec)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [title, description, reward_coins || 10, speed_boost || 0.05, task_type || 'standard', action_type || 'link', link || '', channel_username || '', ad_required ? 1 : 0, wait_time_sec || 10]);

    return { success: true, message: 'Task created successfully!' };
  });

  // Admin: Update Task
  fastify.put('/api/admin/tasks/:id', async (req) => {
    const { id } = req.params;
    const { title, description, reward_coins, speed_boost, task_type, action_type, link, channel_username, ad_required, wait_time_sec, is_active } = req.body;

    await db.run(`
      UPDATE tasks
      SET title = $1, description = $2, reward_coins = $3, speed_boost = $4, task_type = $5, action_type = $6, link = $7, channel_username = $8, ad_required = $9, wait_time_sec = $10, is_active = $11
      WHERE id = $12
    `, [title, description, reward_coins, speed_boost, task_type, action_type, link, channel_username, ad_required ? 1 : 0, wait_time_sec, is_active ? 1 : 0, id]);

    return { success: true, message: 'Task updated successfully!' };
  });

  // Admin: Delete Task
  fastify.delete('/api/admin/tasks/:id', async (req) => {
    const { id } = req.params;
    await db.run('DELETE FROM tasks WHERE id = $1', [id]);
    return { success: true, message: 'Task deleted successfully!' };
  });

  // Admin: Broadcast
  fastify.post('/api/admin/broadcast', async (req, reply) => {
    const { message, photoUrl } = req.body;
    if (!message) return reply.code(400).send({ error: 'Message text is required' });

    try {
      const result = await broadcastMessage(message, photoUrl);
      return { success: true, ...result };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Admin: User list
  fastify.get('/api/admin/users', async (req) => {
    const { search } = req.query;
    let query = 'SELECT id, username, first_name, balance, speed_per_hr, referral_count, is_banned, created_at FROM users';
    let params = [];

    if (search) {
      query += ' WHERE username LIKE $1 OR first_name LIKE $2 OR id = $3';
      params = [`%${search}%`, `%${search}%`, isNaN(Number(search)) ? 0 : Number(search)];
    }
    query += ' ORDER BY created_at DESC LIMIT 100';

    return await db.all(query, params);
  });

  // Admin: Ban/Unban user
  fastify.post('/api/admin/users/:id/ban', async (req) => {
    const { id } = req.params;
    const { is_banned } = req.body;
    await db.run('UPDATE users SET is_banned = $1 WHERE id = $2', [is_banned ? 1 : 0, id]);
    return { success: true, message: is_banned ? 'User banned' : 'User unbanned' };
  });

  // Admin: Manual Speed Boost or Balance Adjustment
  fastify.post('/api/admin/users/:id/boost', async (req) => {
    const { id } = req.params;
    const { bonus_speed, bonus_coins } = req.body;
    await db.run(`
      UPDATE users 
      SET speed_per_hr = speed_per_hr + $1, balance = balance + $2 
      WHERE id = $3
    `, [Number(bonus_speed || 0), Number(bonus_coins || 0), id]);
    return { success: true, message: 'User boosted successfully!' };
  });

  // Start Fastify listener
  try {
    await fastify.listen({ port: config.PORT, host: config.HOST });
    console.log(`🚀 E-FORCE Backend API Server running at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startServer();
