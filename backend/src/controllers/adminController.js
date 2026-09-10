const { pool } = require('../config/database');

const adminController = {
  getDashboard: async (req, res) => {
    try {
      const stats = {};
      const q = async (sql, params) => (await pool.query(sql, params)).rows[0];

      stats.totalUsers = (await q('SELECT COUNT(*) as count FROM users'))?.count || 0;
      stats.totalResellers = (await q("SELECT COUNT(*) as count FROM resellers WHERE status = 'active'"))?.count || 0;

      const today = new Date().toISOString().split('T')[0];
      stats.transactionsToday = (await q('SELECT COUNT(*) as count FROM transactions WHERE DATE(created_at) = $1', [today]))?.count || 0;
      stats.successfulPayments = (await q("SELECT COUNT(*) as count FROM transactions WHERE DATE(created_at) = $1 AND status = 'success'", [today]))?.count || 0;
      stats.pendingPayments = (await q("SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'"))?.count || 0;
      stats.failedPayments = (await q("SELECT COUNT(*) as count FROM transactions WHERE DATE(created_at) = $1 AND status = 'failed'", [today]))?.count || 0;
      stats.totalRevenue = (await q("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'success'"))?.total || 0;
      stats.activeSubscriptions = (await q("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'"))?.count || 0;

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getUsers: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search || '';
      const offset = (page - 1) * limit;

      let query = `SELECT u.id, u.email, u.name, u.avatar, u.status, u.last_login, u.created_at, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id`;
      let countQuery = 'SELECT COUNT(*) as count FROM users u';
      const params = [];
      const countParams = [];

      if (search) {
        query += ` WHERE u.email ILIKE $1 OR u.name ILIKE $1`;
        countQuery += ` WHERE u.email ILIKE $1 OR u.name ILIKE $1`;
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      const countResult = await pool.query(countQuery, countParams);

      res.json({ success: true, data: { users: result.rows, total: parseInt(countResult.rows[0].count), page, limit } });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  updateUserStatus: async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;
      if (!['active', 'banned', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Invalid status' } });
      }
      await pool.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, userId]);
      await pool.query("INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES ($1, 'ADMIN', $2, 'user', $3, $4, $5)",
        [req.session.userId, status === 'banned' ? 'BAN_USER' : status === 'suspended' ? 'SUSPEND_USER' : 'ACTIVATE_USER', userId, JSON.stringify({ newStatus: status }), req.ip]);
      res.json({ success: true, message: `User ${status}` });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getResellers: async (req, res) => {
    try {
      const result = await pool.query('SELECT r.*, u.email, u.name, u.status as user_status FROM resellers r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC');
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get resellers error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  updateReseller: async (req, res) => {
    try {
      const { resellerId } = req.params;
      const { status, custom_rate_limit } = req.body;
      if (status) await pool.query('UPDATE resellers SET status = $1, updated_at = NOW() WHERE id = $2', [status, resellerId]);
      if (custom_rate_limit !== undefined) await pool.query('UPDATE resellers SET custom_rate_limit = $1, updated_at = NOW() WHERE id = $2', [custom_rate_limit, resellerId]);
      res.json({ success: true, message: 'Reseller updated' });
    } catch (error) {
      console.error('Update reseller error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getTransactions: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;
      const offset = (page - 1) * limit;

      let query = `SELECT t.*, u.email as user_email, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id`;
      let countQuery = 'SELECT COUNT(*) as count FROM transactions t';
      const params = [];
      const countParams = [];

      if (status) {
        query += ` WHERE t.status = $1`;
        countQuery += ` WHERE t.status = $1`;
        params.push(status);
        countParams.push(status);
      }

      query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      const countResult = await pool.query(countQuery, countParams);

      res.json({ success: true, data: { transactions: result.rows, total: parseInt(countResult.rows[0].count), page, limit } });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  updateUserPlan: async (req, res) => {
    try {
      const { userId } = req.params;
      const { plan_slug, custom_rate_limit } = req.body;
      const planResult = await pool.query('SELECT id FROM plans WHERE slug = $1', [plan_slug]);
      if (planResult.rows.length === 0) return res.status(400).json({ success: false, error: { code: 'INVALID_PLAN', message: 'Invalid plan' } });

      await pool.query(
        `INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at, custom_rate_limit)
         VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days', $3)
         ON CONFLICT (user_id) DO UPDATE SET plan_id = $2, status = 'active', started_at = NOW(), expired_at = NOW() + INTERVAL '30 days', custom_rate_limit = $3, updated_at = NOW()`,
        [userId, planResult.rows[0].id, custom_rate_limit || null]
      );

      await pool.query("INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES ($1, 'ADMIN', 'CHANGE_PLAN', 'user', $2, $3, $4)",
        [req.session.userId, userId, JSON.stringify({ plan_slug, custom_rate_limit }), req.ip]);

      res.json({ success: true, message: 'Plan updated' });
    } catch (error) {
      console.error('Update plan error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getAuditLogs: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const result = await pool.query(
        `SELECT a.*, u.email as actor_email, u.name as actor_name FROM audit_logs a LEFT JOIN users u ON a.actor_id = u.id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const countResult = await pool.query('SELECT COUNT(*) FROM audit_logs');

      res.json({ success: true, data: { logs: result.rows, total: parseInt(countResult.rows[0].count), page, limit } });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getPlans: async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM plans ORDER BY display_order');
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get plans error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  updatePlan: async (req, res) => {
    try {
      const { planId } = req.params;
      const { price, daily_limit, rate_limit, badge, marketing_text, is_active } = req.body;
      const updates = [];
      const values = [];
      let i = 1;

      if (price !== undefined) { updates.push(`price = $${i}`); values.push(price); i++; }
      if (daily_limit !== undefined) { updates.push(`daily_limit = $${i}`); values.push(daily_limit); i++; }
      if (rate_limit !== undefined) { updates.push(`rate_limit = $${i}`); values.push(rate_limit); i++; }
      if (badge !== undefined) { updates.push(`badge = $${i}`); values.push(badge); i++; }
      if (marketing_text !== undefined) { updates.push(`marketing_text = $${i}`); values.push(marketing_text); i++; }
      if (is_active !== undefined) { updates.push(`is_active = $${i}`); values.push(is_active); i++; }

      if (updates.length === 0) return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No updates provided' } });

      values.push(planId);
      await pool.query(`UPDATE plans SET ${updates.join(', ')} WHERE id = $${i}`, values);
      res.json({ success: true, message: 'Plan updated' });
    } catch (error) {
      console.error('Update plan error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  }
};

module.exports = adminController;
