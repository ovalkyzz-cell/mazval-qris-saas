const passport = require('passport');
const { pool } = require('../config/database');

const authController = {
  // Google OAuth login
  googleLogin: passport.authenticate('google', { scope: ['profile', 'email'] }),

  // Google OAuth callback
  googleCallback: async (req, res, next) => {
    passport.authenticate('google', { failureRedirect: `${process.env.APP_URL}/login` }, (err, user) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.redirect(`${process.env.APP_URL}/login?error=auth_failed`);
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        // Log audit
        pool.query(
          `INSERT INTO audit_logs (actor_id, actor_role, action, ip_address, user_agent)
           VALUES ($1, $2, 'LOGIN', $3, $4)`,
          [user.id, user.role_name, req.ip, req.headers['user-agent']]
        );
        return res.redirect(`${process.env.APP_URL}/dashboard`);
      });
    })(req, res, next);
  },

  // Get current user
  getCurrentUser: async (req, res) => {
    try {
      if (!req.user) {
        return res.json({ success: true, data: { user: null } });
      }

      const result = await pool.query(
        `SELECT u.id, u.email, u.name, u.avatar, u.status, u.created_at,
                r.name as role_name, r.permissions
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [req.user.id]
      );

      const user = result.rows[0];

      // Get subscription
      const subResult = await pool.query(
        `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price, p.daily_limit, p.rate_limit
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = $1 AND s.status = 'active'`,
        [req.user.id]
      );

      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      const usageResult = await pool.query(
        'SELECT transaction_count FROM daily_usage WHERE user_id = $1 AND date = $2',
        [req.user.id, today]
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
      const userId = req.user?.id;

      // Log audit
      if (userId) {
        await pool.query(
          `INSERT INTO audit_logs (actor_id, actor_role, action, ip_address, user_agent)
           VALUES ($1, $2, 'LOGOUT', $3, $4)`,
          [userId, req.user.role_name, req.ip, req.headers['user-agent']]
        );
      }

      req.logout((err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            error: { code: 'LOGOUT_ERROR', message: 'Failed to logout' }
          });
        }
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              error: { code: 'SESSION_ERROR', message: 'Failed to destroy session' }
            });
          }
          res.clearCookie('qris_session');
          res.json({ success: true, message: 'Logged out successfully' });
        });
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
