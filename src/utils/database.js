const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('./logger');

const pool = new Pool({
  host: config.DB.host,
  port: config.DB.port,
  database: config.DB.database,
  user: config.DB.user,
  password: config.DB.password,
  min: config.DB.poolMin,
  max: config.DB.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  logger.debug('Database connected');
});

/**
 * Execute a query
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms`);
    return result;
  } catch (error) {
    logger.error(`Database query error: ${error.message}`);
    throw error;
  }
}

/**
 * Get a single row
 */
async function getOne(text, params) {
  const result = await query(text, params);
  return result.rows[0];
}

/**
 * Get multiple rows
 */
async function getMany(text, params) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Insert data
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  const text = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;

  return getOne(text, values);
}

/**
 * Update data
 */
async function update(table, id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

  const text = `
    UPDATE ${table}
    SET ${setClause}, updated_at = NOW()
    WHERE id = $${keys.length + 1}
    RETURNING *
  `;

  return getOne(text, [...values, id]);
}

/**
 * Delete data
 */
async function deleteRow(table, id) {
  const text = `DELETE FROM ${table} WHERE id = $1`;
  return query(text, [id]);
}

/**
 * Get connection for transactions
 */
async function getConnection() {
  return pool.connect();
}

/**
 * Close pool
 */
async function end() {
  await pool.end();
  logger.info('Database pool closed');
}

module.exports = {
  query,
  getOne,
  getMany,
  insert,
  update,
  deleteRow,
  getConnection,
  end,
  pool,
};
