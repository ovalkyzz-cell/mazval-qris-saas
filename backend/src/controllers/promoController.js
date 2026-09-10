const crypto = require('crypto');
const { pool } = require('../config/database');

const promoController = {
  generateCode: () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    for (let i = 0; i < 3; i++) {
      let segment = '';
      for (let j = 0; j < 3; j++) segment += chars[crypto.randomInt(chars.length)];
      segments.push(segment);
    }
    return `GOVAL-${segments.join('-')}`;
  },

  createPromo: async (req, res) => {
    try {
      const { type, value, max_usage, minimum_amount, starts_at, expires_at } = req.body;
      if (!type || !value) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Type and value required' } });
      if (!['percentage', 'fixed'].includes(type)) return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Invalid type' } });

      const code = promoController.generateCode();
      const result = await pool.query(
        'INSERT INTO promo_codes (code, type, value, max_usage, minimum_amount, starts_at, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [code, type, value, max_usage || null, minimum_amount || 0, starts_at || null, expires_at || null, req.session.userId]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Create promo error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getPromos: async (req, res) => {
    try {
      const result = await pool.query('SELECT p.*, u.email as created_by_email FROM promo_codes p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.created_at DESC');
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get promos error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  updatePromo: async (req, res) => {
    try {
      const { promoId } = req.params;
      const { status, max_usage, expires_at } = req.body;
      const updates = [];
      const values = [];
      let i = 1;

      if (status) { updates.push(`status = $${i}`); values.push(status); i++; }
      if (max_usage !== undefined) { updates.push(`max_usage = $${i}`); values.push(max_usage); i++; }
      if (expires_at) { updates.push(`expires_at = $${i}`); values.push(expires_at); i++; }

      if (updates.length === 0) return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No updates provided' } });

      values.push(promoId);
      await pool.query(`UPDATE promo_codes SET ${updates.join(', ')} WHERE id = $${i}`, values);
      res.json({ success: true, message: 'Promo updated' });
    } catch (error) {
      console.error('Update promo error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  validatePromo: async (req, res) => {
    try {
      const { code } = req.body;
      const result = await pool.query(
        "SELECT * FROM promo_codes WHERE code = $1 AND status = 'active' AND (max_usage IS NULL OR used_count < max_usage)",
        [code.toUpperCase()]
      );
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'INVALID_PROMO', message: 'Promo not found or expired' } });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Validate promo error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  }
};

module.exports = promoController;
