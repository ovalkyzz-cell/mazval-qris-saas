const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const authController = {
  register: async (req, res) => {
    try {
      const { email, name, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password required' } });
      }

      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const result = await pool.query(
        'INSERT INTO users (email, name, password_hash, role_id, status) VALUES ($1, $2, $3, 3, $4) RETURNING id',
        [email, name || email.split('@')[0], passwordHash, 'active']
      );
      const userId = result.rows[0].id;

      const freePlan = await pool.query("SELECT id FROM plans WHERE slug = 'free'");
      if (freePlan.rows.length > 0) {
        await pool.query(
          "INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at) VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '100 years')",
          [userId, freePlan.rows[0].id]
        );
      }

      req.session.userId = userId;
      res.json({ success: true, data: { message: 'Registration successful', userId } });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password required' } });
      }

      const result = await pool.query(
        `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }

      const user = result.rows[0];
      if (user.status !== 'active') {
        return res.status(403).json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' } });
      }

      if (!user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }

      await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
      req.session.userId = user.id;

      res.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, role_name: user.role_name } } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getCurrentUser: async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.json({ success: true, data: { user: null } });
      }

      const result = await pool.query(
        `SELECT u.id, u.email, u.name, u.avatar, u.status, u.created_at, r.name as role_name, r.permissions
         FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [req.session.userId]
      );

      if (result.rows.length === 0) {
        return res.json({ success: true, data: { user: null } });
      }

      const user = result.rows[0];
      const subResult = await pool.query(
        `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price, p.daily_limit, p.rate_limit
         FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.user_id = $1 AND s.status = 'active'`,
        [user.id]
      );

      const today = new Date().toISOString().split('T')[0];
      const usageResult = await pool.query(
        'SELECT transaction_count FROM daily_usage WHERE user_id = $1 AND date = $2',
        [user.id, today]
      );

      res.json({
        success: true,
        data: {
          user: {
            ...user,
            subscription: subResult.rows[0] || null,
            todayUsage: usageResult.rows[0]?.transaction_count || 0
          }
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  logout: async (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ success: false, error: { code: 'LOGOUT_ERROR', message: 'Failed' } });
        res.clearCookie('qris_session');
        res.json({ success: true, message: 'Logged out' });
      });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  }
};

module.exports = authController;
