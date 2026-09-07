import "server-only";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
const globalForRedis = globalThis as typeof globalThis & {
  redisClient?: Redis;
};

const redis = redisUrl
  ? (globalForRedis.redisClient ??= new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    }))
  : null;

async function withRedis<T>(operation: (client: Redis) => Promise<T>, fallback: T): Promise<T> {
  if (!redis) return fallback;

  try {
    if (redis.status === "wait") await redis.connect();
    return await operation(redis);
  } catch (error) {
    console.warn("Cache Redis indisponible, poursuite sans cache:", error);
    return fallback;
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  return withRedis(async (client) => {
    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }, null);
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await withRedis(async (client) => {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return undefined;
  }, undefined);
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await withRedis(async (client) => {
    await client.del(...keys);
    return undefined;
  }, undefined);
}

export function companyCacheKey(userId: string) {
  return `company:${userId}`;
}

export function dashboardCacheKey(companyId: string) {
  return `dashboard:${companyId}`;
}
