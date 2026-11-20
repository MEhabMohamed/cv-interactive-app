import Redis from 'ioredis';
import { RedisCacheProvider } from '../../pkg/cache/redis.js';

export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redisClient.on('error', (err) => console.error('[redis] Error:', err.message));
if (process.env.NODE_ENV !== 'test') {
  redisClient.connect().catch((err) => console.error('[redis] Connect Error:', err.message));
}

export const cacheProvider = new RedisCacheProvider(redisClient);

export async function closeRedis() {
  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
}
