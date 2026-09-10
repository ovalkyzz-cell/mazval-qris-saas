const { pool } = require('../config/database');

const adminController = {
  // Dashboard stats
  getDashboard: async (req, res) => {
    try {
      const stats = {};

      const usersResult = pool.query('SELECT COUNT(*) as count FROM users');
      stats.totalUsers = usersResult.rows[0]?.count || 0;

      const resellerResult = pool.query("SELECT COUNT(*) as count FROM resellers WHERE status = 'active'");
      stats.totalResellers = resellerResult.rows[0]?.count || 0;

      const today = new Date().toISOString().split('T')[0];
      const txTodayResult = pool.query('SELECT COUNT(*) as count FROM transactions WHERE date(created_at) = ?', [today]);
      stats.transactionsToday = txTodayResult.rows[0]?.count || 0;

      const successResult = pool.query("SELECT COUNT(*) as count FROM transactions WHERE date(created_at) = ? AND status = 'success'", [today]);
      stats.successfulPayments = successResult.rows[0]?.count || 0;

      const pendingResult = pool.query("SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'");
      stats.pendingPayments = pendingResult.rows[0]?.count || 0;

      const failedResult = pool.query("SELECT COUNT(*) as count FROM transactions WHERE date(created_at) = ? AND status = 'failed'", [today]);
      stats.failedPayments = failedResult.rows[0]?.count || 0;

      const revenueResult = pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'success'");
      stats.totalRevenue = revenueResult.rows[0]?.total || 0;

      const subResult = pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'");
      stats.activeSubscriptions = subResult.rows[0]?.count || 0;

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get all users
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
        query += ` WHERE u.email LIKE ? OR u.name LIKE ?`;
        countQuery += ` WHERE u.email LIKE ? OR u.name LIKE ?`;
        params.push(`%${search}%`, `%${search}%`);
        countParams.push(`%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const result = pool.query(query, params);
      const countResult = pool.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          users: result.rows,
          total: countResult.rows[0]?.count || 0,
          page,
          limit
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Update user status
  updateUserStatus: async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['active', 'banned', 'suspended'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Invalid status' }
        });
      }

      pool.query('UPDATE users SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, userId]);

      const action = status === 'banned' ? 'BAN_USER' : status === 'suspended' ? 'SUSPEND_USER' : 'ACTIVATE_USER';
      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES (?, ?, ?, 'user', ?, ?, ?)",
        [req.session.userId, 'ADMIN', action, userId, JSON.stringify({ newStatus: status }), req.ip]
      );

      res.json({ success: true, message: `User ${status}` });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get resellers
  getResellers: async (req, res) => {
    try {
      const result = pool.query(
        `SELECT r.*, u.email, u.name, u.status as user_status
         FROM resellers r
         JOIN users u ON r.user_id = u.id
         ORDER BY r.created_at DESC`
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get resellers error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Update reseller
  updateReseller: async (req, res) => {
    try {
      const { resellerId } = req.params;
      const { status, custom_rate_limit } = req.body;

      if (status) {
        pool.query('UPDATE resellers SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, resellerId]);
      }

      if (custom_rate_limit !== undefined) {
        pool.query('UPDATE resellers SET custom_rate_limit = ?, updated_at = datetime(\'now\') WHERE id = ?', [custom_rate_limit, resellerId]);
      }

      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES (?, ?, 'UPDATE_RESELLER', 'reseller', ?, ?, ?)",
        [req.session.userId, 'ADMIN', resellerId, JSON.stringify({ status, custom_rate_limit }), req.ip]
      );

      res.json({ success: true, message: 'Reseller updated' });
    } catch (error) {
      console.error('Update reseller error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get all transactions
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
        query += ` WHERE t.status = ?`;
        countQuery += ` WHERE t.status = ?`;
        params.push(status);
        countParams.push(status);
      }

      query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const result = pool.query(query, params);
      const countResult = pool.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          transactions: result.rows,
          total: countResult.rows[0]?.count || 0,
          page,
          limit
        }
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Update user plan
  updateUserPlan: async (req, res) => {
    try {
      const { userId } = req.params;
      const { plan_slug, custom_rate_limit } = req.body;

      const planResult = pool.query('SELECT id FROM plans WHERE slug = ?', [plan_slug]);
      if (planResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PLAN', message: 'Invalid plan' }
        });
      }

      const existing = pool.query('SELECT id FROM subscriptions WHERE user_id = ?', [userId]);
      if (existing.rows.length > 0) {
        pool.query(
          "UPDATE subscriptions SET plan_id = ?, status = 'active', started_at = datetime('now'), expired_at = datetime('now', '+30 days'), custom_rate_limit = ?, updated_at = datetime('now') WHERE user_id = ?",
          [planResult.rows[0].id, custom_rate_limit || null, userId]
        );
      } else {
        pool.query(
          "INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at, custom_rate_limit) VALUES (?, ?, 'active', datetime('now'), datetime('now', '+30 days'), ?)",
          [userId, planResult.rows[0].id, custom_rate_limit || null]
        );
      }

      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES (?, ?, 'CHANGE_PLAN', 'user', ?, ?, ?)",
        [req.session.userId, 'ADMIN', userId, JSON.stringify({ plan_slug, custom_rate_limit }), req.ip]
      );

      res.json({ success: true, message: 'Plan updated' });
    } catch (error) {
      console.error('Update plan error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get audit logs
  getAuditLogs: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const result = pool.query(
        `SELECT a.*, u.email as actor_email, u.name as actor_name
         FROM audit_logs a
         LEFT JOIN users u ON a.actor_id = u.id
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const countResult = pool.query('SELECT COUNT(*) as count FROM audit_logs');

      res.json({
        success: true,
        data: {
          logs: result.rows,
          total: countResult.rows[0]?.count || 0,
          page,
          limit
        }
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get plans
  getPlans: async (req, res) => {
    try {
      const result = pool.query('SELECT * FROM plans ORDER BY display_order');
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get plans error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Update plan
  updatePlan: async (req, res) => {
    try {
      const { planId } = req.params;
      const { price, daily_limit, rate_limit, features, badge, marketing_text, is_active } = req.body;

      const updates = [];
      const values = [];

      if (price !== undefined) { updates.push('price = ?'); values.push(price); }
      if (daily_limit !== undefined) { updates.push('daily_limit = ?'); values.push(daily_limit); }
      if (rate_limit !== undefined) { updates.push('rate_limit = ?'); values.push(rate_limit); }
      if (features !== undefined) { updates.push('features = ?'); values.push(JSON.stringify(features)); }
      if (badge !== undefined) { updates.push('badge = ?'); values.push(badge); }
      if (marketing_text !== undefined) { updates.push('marketing_text = ?'); values.push(marketing_text); }
      if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_UPDATES', message: 'No updates provided' }
        });
      }

      values.push(planId);
      pool.query(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`, values);

      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES (?, ?, 'UPDATE_PLAN', 'plan', ?, ?, ?)",
        [req.session.userId, 'ADMIN', planId, JSON.stringify(req.body), req.ip]
      );

      res.json({ success: true, message: 'Plan updated' });
    } catch (error) {
      console.error('Update plan error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  }
};

module.exports = adminController;
