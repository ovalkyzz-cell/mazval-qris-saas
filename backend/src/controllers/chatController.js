const { pool } = require('../config/database');

const chatController = {
  getConversations: async (req, res) => {
    try {
      const result = await pool.query('SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC', [req.session.userId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  createConversation: async (req, res) => {
    try {
      const result = await pool.query('INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *', [req.session.userId, req.body.title || 'New Chat']);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getMessages: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const convResult = await pool.query('SELECT * FROM conversations WHERE id = $1 AND user_id = $2', [conversationId, req.session.userId]);
      if (convResult.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });

      const result = await pool.query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [conversationId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  sendMessage: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;

      const convResult = await pool.query('SELECT * FROM conversations WHERE id = $1 AND user_id = $2', [conversationId, req.session.userId]);
      if (convResult.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });

      await pool.query('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [conversationId, 'user', content]);
      await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

      const aiResponse = 'Ini adalah placeholder response. Integrasi dengan AI service untuk response yang sesungguhnya.';
      await pool.query('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [conversationId, 'assistant', aiResponse]);

      res.json({ success: true, data: { userMessage: { role: 'user', content }, assistantMessage: { role: 'assistant', content: aiResponse } } });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  updateConversation: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { title } = req.body;
      await pool.query('UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [title, conversationId, req.session.userId]);
      const result = await pool.query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Update conversation error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  deleteConversation: async (req, res) => {
    try {
      const { conversationId } = req.params;
      await pool.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
      await pool.query('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [conversationId, req.session.userId]);
      res.json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  }
};

module.exports = chatController;
