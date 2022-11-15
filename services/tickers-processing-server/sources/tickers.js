import {workerData} from 'worker_threads';
import {BinanceClient} from 'ccxws';
import {OrderBook} from 'ccxt';
import {RedisClient} from 'redis';

import {createCacheClient} from '@base/cache';

/**
 * Handle ticker limits change events.
 *
 * @param {RedisClient} batch - redis client.
 * @param {object} limit - updated limit, either ask or bid.
 * @param {string} name - which key to use to update cache.
 */
function updateLimit(batch, limit, name) {
  if (parseFloat(limit.size) === 0.0) {
    batch.zRem(name, limit.size);
  } else {
    batch.zAdd(name, {score: limit.size, value: limit.price});
  }
}

/**
 * Handle ticker limits change events.
 *
 * @param {OrderBook} limits - current ticker limits.
 * @param {RedisClient} redis - redis client.
 */
async function onLimitsUpdate(limits, redis) {
  const batch = redis.multi();

  limits.asks.forEach((ask) =>
    updateLimit(batch, ask, `${limits.base}:${limits.quote}:ask`),
  );
  limits.bids.forEach((bid) =>
    updateLimit(batch, bid, `${limits.base}:${limits.quote}:bid`),
  );

  await batch.exec();
}

/**
 * Continuously listen to the current ticker.
 *
 * @param {BinanceClient} exchange - binance client.
 * @param {object} ticker - a ticker.
 * @param {RedisClient} redis - redis client.
 */
function subscribeToTrades(exchange, ticker, redis) {
  exchange.on('l2update', (limits) => onLimitsUpdate(limits, redis));
  if (!exchange.subscribeLevel2Updates(ticker)) {
    throw new Error(`Failed to subscribe to ${ticker.id} market`);
  }
}

(async function () {
  const exchange = new BinanceClient();
  const ticker = workerData.ticker;
  const redis = await createCacheClient();
  subscribeToTrades(exchange, ticker, redis);
  console.debug(`Subscribed to "${ticker.id}" ticker changes`);
})();
