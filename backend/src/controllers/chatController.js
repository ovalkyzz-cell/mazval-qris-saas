const { pool } = require('../config/database');

const chatController = {
  // Get conversations
  getConversations: async (req, res) => {
    try {
      const result = pool.query(
        `SELECT id, title, created_at, updated_at
         FROM conversations
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
        [req.session.userId]
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
      const result = pool.query(
        `INSERT INTO conversations (user_id, title)
         VALUES (?, ?)`,
        [req.session.userId, req.body.title || 'New Chat']
      );

      const conv = pool.query('SELECT * FROM conversations WHERE id = ?', [result.rows[0]?.id]);

      res.json({ success: true, data: conv.rows[0] });
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

      const convResult = pool.query(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [conversationId, req.session.userId]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        });
      }

      const result = pool.query(
        `SELECT * FROM messages
         WHERE conversation_id = ?
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

      const convResult = pool.query(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [conversationId, req.session.userId]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        });
      }

      // Save user message
      pool.query(
        `INSERT INTO messages (conversation_id, role, content)
         VALUES (?, 'user', ?)`,
        [conversationId, content]
      );

      // Update conversation timestamp
      pool.query(
        "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
        [conversationId]
      );

      // AI response placeholder
      const aiResponse = 'Ini adalah placeholder response. Integrasi dengan AI service untuk response yang sesungguhnya.';

      pool.query(
        `INSERT INTO messages (conversation_id, role, content)
         VALUES (?, 'assistant', ?)`,
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

      pool.query(
        "UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
        [title, conversationId, req.session.userId]
      );

      const result = pool.query('SELECT * FROM conversations WHERE id = ?', [conversationId]);

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

      pool.query('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
      pool.query('DELETE FROM conversations WHERE id = ? AND user_id = ?', [conversationId, req.session.userId]);

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
