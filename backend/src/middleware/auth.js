const { pool } = require('../config/database');

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Please login' }
  });
};

// Check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );
    if (result.rows[0]?.name === 'ADMIN') {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' }
    });
  }
};

// Check if user is reseller
const isReseller = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );
    if (result.rows[0]?.name === 'RESELLER' || result.rows[0]?.name === 'ADMIN') {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Reseller access required' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' }
    });
  }
};

// Check specific permission
const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT r.permissions FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
        [req.user.id]
      );
      const permissions = result.rows[0]?.permissions || [];
      if (permissions.includes('*') || permissions.includes(permission)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  };
};

// Check subscription status
const hasActiveSubscription = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.*, p.slug as plan_slug, p.name as plan_name
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.status = 'active'`,
      [req.user.id]
    );
    if (result.rows.length > 0) {
      req.subscription = result.rows[0];
      return next();
    }
    return res.status(403).json({
      success: false,
      error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' }
    });
  }
};

// Check user status
const isActiveUser = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT status FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows[0]?.status === 'active') {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' }
    });
  }
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isReseller,
  hasPermission,
  hasActiveSubscription,
  isActiveUser
};
