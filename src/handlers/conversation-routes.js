const express = require('express');
const auth = require('../middleware/auth');
const conversationModel = require('../models/conversation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/conversations - Get user's conversations
 */
router.get('/', auth.authenticateHTTP, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const conversations = await conversationModel.getUserConversations(userId, limit, offset);
    res.json({
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    logger.error(`Error fetching conversations: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/conversations/:conversationId - Get specific conversation
 */
router.get('/:conversationId', auth.authenticateHTTP, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.user_id;

    const conversation = await conversationModel.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Verify ownership
    if (conversation.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const messages = await conversationModel.getConversationHistory(conversationId);

    res.json({
      conversation,
      messages,
    });
  } catch (error) {
    logger.error(`Error fetching conversation: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * POST /api/conversations - Create new conversation
 */
router.post('/', auth.authenticateHTTP, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { containerId, title } = req.body;

    if (!containerId) {
      return res.status(400).json({ error: 'containerId is required' });
    }

    const conversation = await conversationModel.createConversation(userId, containerId, title);

    res.status(201).json(conversation);
  } catch (error) {
    logger.error(`Error creating conversation: ${error.message}`);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * PUT /api/conversations/:conversationId - Update conversation
 */
router.put('/:conversationId', auth.authenticateHTTP, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.user_id;
    const { title } = req.body;

    const conversation = await conversationModel.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (title) {
      const updated = await conversationModel.updateConversationTitle(conversationId, title);
      return res.json(updated);
    }

    res.json(conversation);
  } catch (error) {
    logger.error(`Error updating conversation: ${error.message}`);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/conversations/:conversationId - Delete conversation
 */
router.delete('/:conversationId', auth.authenticateHTTP, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.user_id;

    const conversation = await conversationModel.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await conversationModel.deleteConversation(conversationId);

    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting conversation: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;
