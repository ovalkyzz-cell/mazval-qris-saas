const crypto = require('crypto');
const { pool } = require('../config/database');

const promoController = {
  // Generate promo code
  generateCode: () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    for (let i = 0; i < 3; i++) {
      let segment = '';
      for (let j = 0; j < 3; j++) {
        segment += chars[crypto.randomInt(chars.length)];
      }
      segments.push(segment);
    }
    return `GOVAL-${segments.join('-')}`;
  },

  // Create promo code (Admin only)
  createPromo: async (req, res) => {
    try {
      const { type, value, max_usage, minimum_amount, starts_at, expires_at } = req.body;

      if (!type || !value) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Type and value are required' }
        });
      }

      if (!['percentage', 'fixed'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TYPE', message: 'Type must be percentage or fixed' }
        });
      }

      const code = promoController.generateCode();

      const result = pool.query(
        `INSERT INTO promo_codes (code, type, value, max_usage, minimum_amount, starts_at, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, type, value, max_usage || null, minimum_amount || 0, starts_at || null, expires_at || null, req.session.userId]
      );

      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES (?, ?, 'CREATE_PROMO', 'promo', ?, ?, ?)",
        [req.session.userId, 'ADMIN', result.rows[0]?.id, JSON.stringify({ code, type, value }), req.ip]
      );

      res.json({ success: true, data: { id: result.rows[0]?.id, code, type, value } });
    } catch (error) {
      console.error('Create promo error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get all promo codes (Admin only)
  getPromos: async (req, res) => {
    try {
      const result = pool.query(
        `SELECT p.*, u.email as created_by_email
         FROM promo_codes p
         LEFT JOIN users u ON p.created_by = u.id
         ORDER BY p.created_at DESC`
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get promos error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Update promo (Admin only)
  updatePromo: async (req, res) => {
    try {
      const { promoId } = req.params;
      const { status, max_usage, expires_at } = req.body;

      const updates = [];
      const values = [];

      if (status) { updates.push('status = ?'); values.push(status); }
      if (max_usage !== undefined) { updates.push('max_usage = ?'); values.push(max_usage); }
      if (expires_at) { updates.push('expires_at = ?'); values.push(expires_at); }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_UPDATES', message: 'No updates provided' }
        });
      }

      values.push(promoId);
      pool.query(`UPDATE promo_codes SET ${updates.join(', ')} WHERE id = ?`, values);

      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES (?, ?, 'UPDATE_PROMO', 'promo', ?, ?, ?)",
        [req.session.userId, 'ADMIN', promoId, JSON.stringify(req.body), req.ip]
      );

      res.json({ success: true, message: 'Promo updated' });
    } catch (error) {
      console.error('Update promo error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Validate promo code
  validatePromo: async (req, res) => {
    try {
      const { code } = req.body;

      const result = pool.query(
        `SELECT * FROM promo_codes
         WHERE code = ? AND status = 'active'
         AND (starts_at IS NULL OR starts_at <= datetime('now'))
         AND (expires_at IS NULL OR expires_at >= datetime('now'))
         AND (max_usage IS NULL OR used_count < max_usage)`,
        [code.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'INVALID_PROMO', message: 'Promo code not found or expired' }
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Validate promo error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  }
};

module.exports = promoController;
