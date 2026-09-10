const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const authController = {
  // Register
  register: async (req, res) => {
    try {
      const { email, name, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Email and password are required' }
        });
      }

      // Check if user exists
      const existing = pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'Email already registered' }
        });
      }

      // Hash password
      const passwordHash = bcrypt.hashSync(password, 10);

      // Get USER role
      const roleResult = pool.query("SELECT id FROM roles WHERE name = 'USER'");
      const roleId = roleResult.rows[0]?.id || 3;

      // Create user
      const result = pool.query(
        'INSERT INTO users (email, name, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?)',
        [email, name || email.split('@')[0], passwordHash, roleId, 'active']
      );

      const userId = result.rows[0]?.id;

      // Create free subscription
      const freePlan = pool.query("SELECT id FROM plans WHERE slug = 'free'");
      if (freePlan.rows.length > 0) {
        pool.query(
          "INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at) VALUES (?, ?, 'active', datetime('now'), datetime('now', '+100 years'))",
          [userId, freePlan.rows[0].id]
        );
      }

      // Set session
      req.session.userId = userId;

      // Audit log
      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, ip_address) VALUES (?, 'USER', 'REGISTER', ?)",
        [userId, req.ip]
      );

      res.json({
        success: true,
        data: { message: 'Registration successful', userId }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Email and password are required' }
        });
      }

      // Find user
      const result = pool.query(
        `SELECT u.*, r.name as role_name, r.permissions 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.email = ?`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
        });
      }

      const user = result.rows[0];

      // Check status
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' }
        });
      }

      // Check password
      if (!user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
        });
      }

      // Update last login
      pool.query("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);

      // Set session
      req.session.userId = user.id;

      // Audit log
      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, ip_address, user_agent) VALUES (?, ?, 'LOGIN', ?, ?)",
        [user.id, user.role_name, req.ip, req.headers['user-agent']]
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role_name: user.role_name
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get current user
  getCurrentUser: async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.json({ success: true, data: { user: null } });
      }

      const result = pool.query(
        `SELECT u.id, u.email, u.name, u.avatar, u.status, u.created_at,
                r.name as role_name, r.permissions
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [req.session.userId]
      );

      const user = result.rows[0];
      if (!user) {
        return res.json({ success: true, data: { user: null } });
      }

      // Get subscription
      const subResult = pool.query(
        `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price, p.daily_limit, p.rate_limit
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ? AND s.status = 'active'`,
        [user.id]
      );

      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      const usageResult = pool.query(
        'SELECT transaction_count FROM daily_usage WHERE user_id = ? AND date = ?',
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
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      const userId = req.session?.userId;

      if (userId) {
        pool.query(
          "INSERT INTO audit_logs (actor_id, actor_role, action, ip_address, user_agent) VALUES (?, 'USER', 'LOGOUT', ?, ?)",
          [userId, req.ip, req.headers['user-agent']]
        );
      }

      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            error: { code: 'LOGOUT_ERROR', message: 'Failed to logout' }
          });
        }
        res.clearCookie('qris_session');
        res.json({ success: true, message: 'Logged out successfully' });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  }
};

module.exports = authController;
