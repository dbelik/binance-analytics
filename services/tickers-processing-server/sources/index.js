import dotenv from 'dotenv';
dotenv.config();

import cctx from 'ccxt';
import path from 'path';
import {sql, DatabasePool} from 'slonik';
import {Worker} from 'worker_threads';

import {createConnection} from '@base/databases';

/**
 * Fetch a limited number of tickers from an exchange.
 *
 * @param {cctx.Exchange} exchange - an exchange, such as Binance.
 * @param {number} maxTickers - total number of tickers.
 * @return {object[]} - limited number of tickers from an exchange.
 */
async function getTickers(exchange, maxTickers = process.env.MAX_TICKERS) {
  const allTickers = Object.values(await exchange.fetchTickers());
  const limitedTickers = allTickers.slice(0, maxTickers);
  const tickers = limitedTickers.map((ticker) => {
    const data = {
      id: ticker.info.symbol,
      base: ticker.symbol.split('/')[0],
      quote: ticker.symbol.split('/')[1],
    };
    return data;
  });
  return tickers;
}

/**
 * Creates separate tables for asks and bids for each
 * ticker.
 *
 * @param {DatabasePool} connection - database connection.
 * @param {object[]} tickers - available tickers.
 */
async function initTickersTables(connection, tickers) {
  // Generate all possible tables that should be created for each ticker.
  const types = ['bid', 'ask'];
  const tables = types
    .map((type) =>
      tickers.map((ticker) => `${ticker.base}:${ticker.quote}:${type}`),
    )
    .flat();

  // Create tables for both schemas.
  const schemas = [`raw`, `m1`];
  await Promise.all(
    schemas
      .map(async (schema) => {
        tables.map((table) => {
          const schemaIdentifier = sql.identifier([schema]);
          const tableIdentifier = sql.identifier([table]);
          return connection.query(sql`
          CREATE TABLE IF NOT EXISTS ${schemaIdentifier}.${tableIdentifier} (
            price REAL NOT NULL,
            size REAL NOT NULL,
            created_at TIMESTAMP NOT NULL
          )
        `);
        });
      })
      .flat(),
  );
}

(async function () {
  // Start monitoring tickers for changes. We need to create
  // a separate worker for each ticker that uses WebSockets
  // to retrieve current bids/asks.
  const exchange = new cctx.binance();
  const tickers = await getTickers(exchange);
  console.debug(`Starting ${tickers.length} workers ...`);
  tickers.forEach((ticker) => {
    const tickerWorkerPath = path.join(__dirname, 'tickers.js');
    new Worker(tickerWorkerPath, {workerData: {ticker}});
  });

  // We must make sure that all tickers have dedicated
  // tables for asks and bids.
  const connection = await createConnection();
  await initTickersTables(connection, tickers);

  // Then we create a separate worker that stores cached tickers
  // in the database.
  console.debug(`Starting persist worker ...`);
  const persistWorkerPath = path.join(__dirname, 'persist.js');
  new Worker(persistWorkerPath, {workerData: {tickers}});
})();
