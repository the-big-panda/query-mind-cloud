const db = require('../utils/database');
const redis = require('../utils/redis-client');
const logger = require('../utils/logger');

/**
 * Create a new conversation
 */
async function createConversation(userId, containerId, title = null) {
  return db.insert('conversations', {
    user_id: userId,
    container_id: containerId,
    title: title || `Conversation ${new Date().toISOString()}`,
  });
}

/**
 * Get conversation history
 */
async function getConversationHistory(conversationId, limit = 50) {
  return db.getMany(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2',
    [conversationId, limit],
  );
}

/**
 * Add message to conversation
 */
async function addMessage(conversationId, role, content) {
  return db.insert('messages', {
    conversation_id: conversationId,
    role,
    content: typeof content === 'string' ? content : JSON.stringify(content),
  });
}

/**
 * Get all conversations for user
 */
async function getUserConversations(userId, limit = 20, offset = 0) {
  return db.getMany(
    `SELECT id, user_id, container_id, title, created_at, updated_at 
     FROM conversations 
     WHERE user_id = $1 
     ORDER BY updated_at DESC 
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
}

/**
 * Get conversation details
 */
async function getConversation(conversationId) {
  return db.getOne(
    'SELECT * FROM conversations WHERE id = $1',
    [conversationId],
  );
}

/**
 * Update conversation title
 */
async function updateConversationTitle(conversationId, title) {
  return db.update('conversations', conversationId, { title });
}

/**
 * Delete conversation
 */
async function deleteConversation(conversationId) {
  // Delete messages first
  await db.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
  // Delete conversation
  return db.deleteRow('conversations', conversationId);
}

module.exports = {
  createConversation,
  getConversationHistory,
  addMessage,
  getUserConversations,
  getConversation,
  updateConversationTitle,
  deleteConversation,
};
