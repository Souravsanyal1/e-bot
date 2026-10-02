import { db } from '../db/index.js';
import { config } from '../config.js';
import { cache } from '../redis.js';

export function calculateMiningState(user) {
  const speed = Number(user.speed_per_hr || config.BASE_MINING_RATE);
  const sessionHours = config.SESSION_DURATION_HOURS || 24;
  const sessionSeconds = sessionHours * 3600;

  if (!user.mining_start_time) {
    return {
      status: 'idle',
      is_mining: false,
      speed_per_hr: speed,
      session_hours: sessionHours,
      elapsed_seconds: 0,
      remaining_seconds: sessionSeconds,
      progress_percent: 0,
      mined_unclaimed: 0.0,
      total_balance: Number(user.balance || 0),
    };
  }

  const startTime = new Date(user.mining_start_time).getTime();
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

  if (elapsedSeconds >= sessionSeconds) {
    // 24h session finished, waiting for claim
    const maxMined = (sessionSeconds / 3600) * speed;
    return {
      status: 'claimable',
      is_mining: false,
      speed_per_hr: speed,
      session_hours: sessionHours,
      elapsed_seconds: sessionSeconds,
      remaining_seconds: 0,
      progress_percent: 100,
      mined_unclaimed: Number(maxMined.toFixed(6)),
      total_balance: Number(user.balance || 0),
    };
  }

  // Active mining session
  const minedCurrent = (elapsedSeconds / 3600) * speed;
  const progress = Math.min(100, (elapsedSeconds / sessionSeconds) * 100);

  return {
    status: 'mining',
    is_mining: true,
    speed_per_hr: speed,
    session_hours: sessionHours,
    elapsed_seconds: elapsedSeconds,
    remaining_seconds: sessionSeconds - elapsedSeconds,
    progress_percent: Number(progress.toFixed(2)),
    mined_unclaimed: Number(minedCurrent.toFixed(6)),
    total_balance: Number(user.balance || 0),
  };
}

export async function startMiningSession(userId) {
  const user = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) throw new Error('User not found');
  if (user.is_banned) throw new Error('Account suspended');

  const nowIso = new Date().toISOString();
  await db.run('UPDATE users SET mining_start_time = $1 WHERE id = $2', [nowIso, userId]);

  const updated = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
  return calculateMiningState(updated);
}

export async function claimMiningSession(userId) {
  const user = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) throw new Error('User not found');
  if (user.is_banned) throw new Error('Account suspended');

  const state = calculateMiningState(user);
  if (state.mined_unclaimed <= 0) {
    throw new Error('No mined tokens available to claim yet.');
  }

  const claimAmount = state.mined_unclaimed;
  const newBalance = Number(user.balance || 0) + claimAmount;
  const nowIso = new Date().toISOString();

  // Reset mining timer to start fresh 24h cycle immediately upon claiming
  await db.run(`
    UPDATE users 
    SET balance = $1, 
        last_claim_time = $2, 
        mining_start_time = $3 
    WHERE id = $4
  `, [newBalance, nowIso, nowIso, userId]);

  // Update Redis Leaderboard score
  await cache.updateScore('leaderboard:miners', String(userId), newBalance);

  const updatedUser = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
  return {
    claimed_amount: claimAmount,
    new_balance: newBalance,
    mining_state: calculateMiningState(updatedUser)
  };
}
