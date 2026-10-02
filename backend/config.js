import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_IDS: (process.env.ADMIN_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || '',
  MINI_APP_URL: process.env.MINI_APP_URL || 'https://e-force-bot.web.app',
  BOT_USERNAME: process.env.BOT_USERNAME || 'Elite_Force_Official_Mining_bot',
  CHANNEL_URL: process.env.CHANNEL_URL || '',
  COMMUNITY_URL: process.env.COMMUNITY_URL || '',
  ADSGRAM_BLOCK_ID: process.env.ADSGRAM_BLOCK_ID || 'int-9999',
  
  // Mining Defaults
  BASE_MINING_RATE: parseFloat(process.env.BASE_MINING_RATE || '0.5'), // E-FORCE per hour
  SESSION_DURATION_HOURS: parseFloat(process.env.SESSION_DURATION_HOURS || '24'), // 24 hours
  REFERRAL_SPEED_BOOST: parseFloat(process.env.REFERRAL_SPEED_BOOST || '0.05'), // +0.05/hr per friend
  REFERRAL_COIN_BONUS: parseFloat(process.env.REFERRAL_COIN_BONUS || '10.0'), // 10 E-FORCE upfront
};

export const isAdmin = (userId) => {
  if (!userId) return false;
  return config.ADMIN_IDS.includes(String(userId));
};
