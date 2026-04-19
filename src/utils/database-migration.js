const db = require('./database');
const logger = require('./logger');

/**
 * Initialize database schema
 */
async function initializeDatabase() {
  try {
    logger.info('Initializing database schema...');

    // Create conversations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        container_id VARCHAR(255) NOT NULL,
        title VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_container_id (container_id)
      );
    `);

    logger.info('Created conversations table');

    // Create messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_role (role)
      );
    `);

    logger.info('Created messages table');

    // Create sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        container_id VARCHAR(255) NOT NULL,
        token VARCHAR(500),
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        disconnected_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        INDEX idx_user_id (user_id),
        INDEX idx_container_id (container_id)
      );
    `);

    logger.info('Created user_sessions table');

    // Create activity logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action)
      );
    `);

    logger.info('Created activity_logs table');

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize database: ${error.message}`);
    throw error;
  }
}

module.exports = { initializeDatabase };
