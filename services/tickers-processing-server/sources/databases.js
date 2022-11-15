import {createPool, DatabasePool} from 'slonik';

/**
 * Create a connection to the Postgres database.
 *
 * @return {Promise<DatabasePool>}
 */
export function createConnection() {
  return createPool(
    `postgres://${process.env.TICKERS_DB_USER}:${process.env.TICKERS_DB_PASSWORD}@${process.env.TICKERS_DB_HOST}/${process.env.TICKERS_DB_NAME}`,
  );
}
