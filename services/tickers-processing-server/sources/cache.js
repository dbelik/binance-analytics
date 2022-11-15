import {createClient, RedisClient} from 'redis';

/**
 * Create default Redis client.
 *
 * @return {Promise<RedisClient>}
 */
export async function createCacheClient() {
  const client = createClient({
    url: `redis://:${process.env.TICKERS_CACHE_PASSWORD}@${process.env.TICKERS_CACHE_HOST}:${process.env.TICKERS_CACHE_PORT}`,
  });
  await client.connect();
  return client;
}
