import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

export async function initDatabase() {
  if (config.DATABASE_URL) {
    try {
      console.log('Connecting to PostgreSQL database...');
      pgPool = new pg.Pool({
        connectionString: config.DATABASE_URL,
        ssl: config.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await pgPool.connect();
      console.log('PostgreSQL connected successfully!');
      isPostgres = true;

      // Run schema migrations for PostgreSQL
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log('PostgreSQL schema applied successfully.');
      }
      client.release();
      return;
    } catch (err) {
      console.warn('PostgreSQL connection failed. Falling back to local SQLite database:', err.message);
      isPostgres = false;
    }
  } else {
    console.log('No DATABASE_URL found. Initializing local embedded SQLite database...');
  }

  // Fallback to native Node.js SQLite
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'eforce.db');
  sqliteDb = new DatabaseSync(dbPath);

  // Create SQLite tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      balance REAL DEFAULT 0,
      speed_per_hr REAL DEFAULT 0.5,
      mining_start_time TEXT,
      last_claim_time TEXT,
      last_mining_notified_time TEXT,
      referred_by INTEGER,
      referral_count INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      reward_coins REAL DEFAULT 10.0,
      speed_boost REAL DEFAULT 0.05,
      task_type TEXT DEFAULT 'standard',
      action_type TEXT DEFAULT 'link',
      link TEXT,
      channel_username TEXT,
      ad_required INTEGER DEFAULT 0,
      wait_time_sec INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      status TEXT DEFAULT 'completed',
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_id INTEGER NOT NULL UNIQUE,
      bonus_coins REAL DEFAULT 10.0,
      speed_boost REAL DEFAULT 0.05,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed initial tasks if empty
  const countRow = sqliteDb.prepare('SELECT COUNT(*) as count FROM tasks').get();
  if (!countRow || countRow.count === 0) {
    const insert = sqliteDb.prepare(`
      INSERT INTO tasks (title, description, reward_coins, speed_boost, task_type, action_type, link, ad_required, wait_time_sec)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('Watch Sponsored E-FORCE Ad', 'Watch a fast sponsor video ad to boost your mining engine rate permanently!', 25.0, 0.10, 'standard', 'ad', '', 1, 15);
    insert.run('Join Official Telegram Channel', 'Subscribe to the official announcement channel for critical airdrop news.', 50.0, 0.15, 'standard', 'telegram', 'https://t.me/Elite_Force_Official_Mining_bot', 0, 5);
    insert.run('Follow E-FORCE on X (Twitter)', 'Follow our official X handle and retweet the pinned 24H mining announcement.', 35.0, 0.08, 'standard', 'link', 'https://x.com', 0, 10);
    insert.run('🔥 SPECIAL: Supercharge Core with Video Partner', 'Watch our special partner video showcase and unlock double speed boost!', 100.0, 0.25, 'special', 'ad', '', 1, 20);
    insert.run('⚡ SPECIAL: Connect TON / Web3 Wallet Preview', 'Bookmark the upcoming Web3 smart contract connection portal.', 75.0, 0.20, 'special', 'link', 'https://ton.org', 0, 10);
  }

  // Safe migration for existing SQLite users table
  try {
    sqliteDb.exec(`ALTER TABLE users ADD COLUMN last_mining_notified_time TEXT;`);
  } catch (_e) {
    // Column already exists
  }

  console.log('SQLite database initialized at', dbPath);
}

// Universal query runner helper
export const db = {
  isPostgres: () => isPostgres,

  async query(text, params = []) {
    if (isPostgres) {
      return await pgPool.query(text, params);
    } else {
      // Convert $1, $2 to ? for SQLite
      let sql = text;
      let paramIndex = 1;
      while (sql.includes(`$${paramIndex}`)) {
        sql = sql.replace(`$${paramIndex}`, '?');
        paramIndex++;
      }
      const stmt = sqliteDb.prepare(sql);
      const trimmed = sql.trim().toUpperCase();

      if (trimmed.startsWith('SELECT')) {
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const result = stmt.run(...params);
        return { 
          rows: [], 
          rowCount: result.changes, 
          lastInsertRowid: result.lastInsertRowid 
        };
      }
    }
  },

  async get(text, params = []) {
    const res = await this.query(text, params);
    return res.rows[0] || null;
  },

  async all(text, params = []) {
    const res = await this.query(text, params);
    return res.rows || [];
  },

  async run(text, params = []) {
    return await this.query(text, params);
  }
};
