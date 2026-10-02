import Redis from 'ioredis';
import { config } from './config.js';

let redisClient = null;
let isRedisConnected = false;

// In-memory fallback if Redis is not configured or fails
const memoryStore = new Map();
const memorySortedSets = new Map();

class MemoryRedisFallback {
  async get(key) {
    const item = memoryStore.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, exKeyword, seconds) {
    const expiry = (exKeyword === 'EX' && seconds) ? Date.now() + (seconds * 1000) : null;
    memoryStore.set(key, { value: String(value), expiry });
    return 'OK';
  }

  async del(key) {
    memoryStore.delete(key);
    memorySortedSets.delete(key);
    return 1;
  }

  async zadd(key, score, member) {
    let set = memorySortedSets.get(key);
    if (!set) {
      set = new Map();
      memorySortedSets.set(key, set);
    }
    set.set(member, parseFloat(score));
    return 1;
  }

  async zrevrange(key, start, stop, withScoresKeyword) {
    const set = memorySortedSets.get(key);
    if (!set) return [];
    const sorted = Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
    const slice = sorted.slice(start, stop === -1 ? undefined : stop + 1);

    if (withScoresKeyword === 'WITHSCORES') {
      const result = [];
      for (const [member, score] of slice) {
        result.push(member, String(score));
      }
      return result;
    }
    return slice.map(([member]) => member);
  }

  async zrevrank(key, member) {
    const set = memorySortedSets.get(key);
    if (!set) return null;
    const sorted = Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
    const index = sorted.findIndex(([m]) => m === member);
    return index !== -1 ? index : null;
  }
}

export async function initRedis() {
  if (config.REDIS_URL) {
    try {
      console.log('Connecting to Redis...');
      redisClient = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: true
      });

      await redisClient.connect();
      isRedisConnected = true;
      console.log('Redis connected successfully!');
      return;
    } catch (err) {
      console.warn('Redis connection failed. Using in-memory cache/leaderboard fallback:', err.message);
      isRedisConnected = false;
      redisClient = new MemoryRedisFallback();
    }
  } else {
    console.log('No REDIS_URL provided. Initializing in-memory cache and leaderboard store...');
    redisClient = new MemoryRedisFallback();
  }
}

export const cache = {
  get: async (key) => redisClient.get(key),
  set: async (key, val, seconds = 60) => redisClient.set(key, val, 'EX', seconds),
  del: async (key) => redisClient.del(key),

  // Leaderboard methods
  updateScore: async (board, member, score) => {
    return redisClient.zadd(board, score, member);
  },
  getTopUsers: async (board, limit = 50) => {
    return redisClient.zrevrange(board, 0, limit - 1, 'WITHSCORES');
  },
  getUserRank: async (board, member) => {
    return redisClient.zrevrank(board, member);
  }
};
