import {workerData} from 'worker_threads';
import {RedisClient} from 'redis';
import {DatabasePool, sql} from 'slonik';

import {createCacheClient} from '@base/cache';
import {createConnection} from '@base/databases';

/**
 * Generate all possible combinations of the tables from tickers.
 *
 * @param {object[]} tickers - list of tickers.
 * @return {string[]}
 */
function generateTableNames(tickers) {
  const types = ['bid', 'ask'];
  const keys = types
    .map((type) =>
      tickers.map((ticker) => `${ticker.base}:${ticker.quote}:${type}`),
    )
    .flat();
  return keys;
}

/**
 * Extract current prices for the ticker from the cache.
 *
 * @param {RedisClient} redis - redis client.
 * @param {object[]} tickers - list of tickers.
 * @return {Promise}
 */
async function extractTickerData(redis, tickers) {
  const keys = generateTableNames(tickers);

  const tickersData = await Promise.all(
    keys.map(async (key) => ({
      name: key,
      data: await redis.zRangeWithScores(key, 0, -1),
    })),
  );
  return tickersData;
}

/**
 * Store tickers in the raw schema.
 *
 * @param {DatabasePool} connection - database connection.
 * @param {object[]} tickersData - list of tickers prices.
 * @return {Promise}
 */
async function storeTickers(connection, tickersData) {
  const date = new Date().toISOString();
  tickersData.map(async (ticker) => {
    const table = sql.identifier([ticker.name]);
    const data = ticker.data.map((data) => [
      parseFloat(data.value),
      data.score,
      date,
    ]);

    // Insert ticker's data from cache.
    await connection.query(sql`
      INSERT INTO raw.${table}
        SELECT * FROM ${sql.unnest(data, ['float4', 'float4', 'timestamp'])};
    `);
  });
}

/**
 * Select the highest size of a price in the past minute and
 * store it in a separate tables.
 *
 * @param {DatabasePool} connection - database connection.
 * @param {object[]} tickers - list of tickers prices.
 */
async function storeMaxSize(connection, tickers) {
  // We first select highest sizes of a price in the last minute.
  const date = new Date();
  const startDate = new Date(date.getTime() - 1 * 60 * 1000);

  const tables = generateTableNames(tickers);
  await Promise.all(
    tables.map(async (table) => {
      const maxSizes = (
        await connection.query(sql`
          SELECT price, MAX(size) as size
            FROM raw.${sql.identifier([table])}
            WHERE created_at >= ${sql.date(startDate)}
            GROUP BY price;
        `)
      ).rows.map((maxSize) => [
        maxSize.price,
        maxSize.size,
        date.toISOString(),
      ]);

      // Then we insert the resulting data into the m1 schema's tables.
      await connection.query(sql`
        INSERT INTO m1.${sql.identifier([table])}
          SELECT * FROM ${sql.unnest(maxSizes, [
            'float4',
            'float4',
            'timestamp',
          ])};
      `);
    }),
  );
}

(async () => {
  const connection = await createConnection();
  const redis = await createCacheClient();
  const tickers = workerData.tickers;

  // Every second, store cached tickers into the raw schema.
  setInterval(async () => {
    // Store cache in the database.
    const tickersData = await extractTickerData(redis, tickers);
    await storeTickers(connection, tickersData);
  }, 1 * 1000);

  // Every minute, store aggregated data into the m1 schema.
  setInterval(async () => {
    await storeMaxSize(connection, tickers);
  }, 1 * 60 * 1000);
})();
