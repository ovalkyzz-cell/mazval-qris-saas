const { pool } = require('../config/database');

const chatController = {
  // Get conversations
  getConversations: async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, title, created_at, updated_at
         FROM conversations
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [req.user.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Create conversation
  createConversation: async (req, res) => {
    try {
      const result = await pool.query(
        `INSERT INTO conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING *`,
        [req.user.id, req.body.title || 'New Chat']
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get messages
  getMessages: async (req, res) => {
    try {
      const { conversationId } = req.params;

      // Check ownership
      const convResult = await pool.query(
        'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        });
      }

      const result = await pool.query(
        `SELECT * FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Send message
  sendMessage: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;

      // Check ownership
      const convResult = await pool.query(
        'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        });
      }

      // Save user message
      await pool.query(
        `INSERT INTO messages (conversation_id, role, content)
         VALUES ($1, 'user', $2)`,
        [conversationId, content]
      );

      // Update conversation timestamp
      await pool.query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      );

      // Here you would integrate with an AI service
      // For now, we'll just save a placeholder response
      const aiResponse = 'AI response placeholder - integrate with your AI service';

      await pool.query(
        `INSERT INTO messages (conversation_id, role, content)
         VALUES ($1, 'assistant', $2)`,
        [conversationId, aiResponse]
      );

      res.json({
        success: true,
        data: {
          userMessage: { role: 'user', content },
          assistantMessage: { role: 'assistant', content: aiResponse }
        }
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Update conversation title
  updateConversation: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { title } = req.body;

      const result = await pool.query(
        `UPDATE conversations SET title = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [title, conversationId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Update conversation error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Delete conversation
  deleteConversation: async (req, res) => {
    try {
      const { conversationId } = req.params;

      const result = await pool.query(
        'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
        [conversationId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        });
      }

      res.json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  }
};

module.exports = chatController;
