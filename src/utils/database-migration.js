const db = require('./database');
const logger = require('./logger');

/**
 * Initialize database schema
 * NOTE: Cloud-backend ONLY stores:
 *   - user_sessions: Maps users to their AI containers
 *   - activity_logs: Audit trail of actions
 * 
 * Conversations & messages are stored in BE-Project (local machine)
 */
async function initializeDatabase() {
  try {
    logger.info('Initializing database schema...');

    // Create sessions table - Track which user is connected to which container
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        container_id VARCHAR(255) NOT NULL,
        container_name VARCHAR(255),
        container_url TEXT,
        container_port INTEGER,
        token VARCHAR(500),
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        disconnected_at TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_container_id ON user_sessions (container_id);');

    await db.query('ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS container_name VARCHAR(255);');
    await db.query('ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS container_url TEXT;');
    await db.query('ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS container_port INTEGER;');
    await db.query('ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');

    logger.info('Created user_sessions table');

    // Create activity logs table - Audit trail
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs (action);');

    logger.info('Created activity_logs table');

    logger.info('Database schema initialized successfully');
    logger.info('Note: Conversations & messages stored in BE-Project, not here');
  } catch (error) {
    logger.error(`Failed to initialize database: ${error.message}`);
    throw error;
  }
}

module.exports = { initializeDatabase };
