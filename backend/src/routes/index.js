const express = require('express');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');
const adminController = require('../controllers/adminController');
const chatController = require('../controllers/chatController');
const promoController = require('../controllers/promoController');

// Middleware
const { rateLimiter, dailyLimitChecker } = require('../middleware/rateLimiter');

// Auth middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Please login' }
  });
};

const isAdmin = async (req, res, next) => {
  try {
    const { pool } = require('../config/database');
    const result = pool.query(
      'SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [req.session.userId]
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

const isReseller = async (req, res, next) => {
  try {
    const { pool } = require('../config/database');
    const result = pool.query(
      'SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [req.session.userId]
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

// Auth routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authController.getCurrentUser);
router.post('/auth/logout', isAuthenticated, authController.logout);

// Payment routes
router.post('/payments/create', isAuthenticated, rateLimiter, dailyLimitChecker, paymentController.createPayment);
router.get('/payments/:transaction_id/status', isAuthenticated, paymentController.checkStatus);
router.get('/payments/history', isAuthenticated, paymentController.getHistory);

// Chat routes
router.get('/chat/conversations', isAuthenticated, chatController.getConversations);
router.post('/chat/conversations', isAuthenticated, chatController.createConversation);
router.get('/chat/conversations/:conversationId/messages', isAuthenticated, chatController.getMessages);
router.post('/chat/conversations/:conversationId/messages', isAuthenticated, chatController.sendMessage);
router.put('/chat/conversations/:conversationId', isAuthenticated, chatController.updateConversation);
router.delete('/chat/conversations/:conversationId', isAuthenticated, chatController.deleteConversation);

// Public routes
router.get('/plans', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const result = pool.query('SELECT * FROM plans WHERE is_active = 1 ORDER BY display_order');
    // Parse features JSON
    const plans = result.rows.map(p => ({
      ...p,
      features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features
    }));
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

router.post('/promo/validate', promoController.validatePromo);

// Webhook routes (no auth)
router.post('/webhooks/qris', webhookController.handleQrisWebhook);

// Admin routes
router.get('/admin/dashboard', isAuthenticated, isAdmin, adminController.getDashboard);
router.get('/admin/users', isAuthenticated, isAdmin, adminController.getUsers);
router.put('/admin/users/:userId/status', isAuthenticated, isAdmin, adminController.updateUserStatus);
router.put('/admin/users/:userId/plan', isAuthenticated, isAdmin, adminController.updateUserPlan);
router.get('/admin/resellers', isAuthenticated, isAdmin, adminController.getResellers);
router.put('/admin/resellers/:resellerId', isAuthenticated, isAdmin, adminController.updateReseller);
router.get('/admin/transactions', isAuthenticated, isAdmin, adminController.getTransactions);
router.get('/admin/audit-logs', isAuthenticated, isAdmin, adminController.getAuditLogs);
router.get('/admin/plans', isAuthenticated, isAdmin, adminController.getPlans);
router.put('/admin/plans/:planId', isAuthenticated, isAdmin, adminController.updatePlan);
router.post('/admin/promos', isAuthenticated, isAdmin, promoController.createPromo);
router.get('/admin/promos', isAuthenticated, isAdmin, promoController.getPromos);
router.put('/admin/promos/:promoId', isAuthenticated, isAdmin, promoController.updatePromo);

// Reseller routes
router.get('/reseller/customers', isAuthenticated, isReseller, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const result = pool.query(
      `SELECT u.id, u.email, u.name, u.status, u.last_login, u.created_at
       FROM reseller_users ru
       JOIN users u ON ru.user_id = u.id
       WHERE ru.reseller_id = (SELECT id FROM resellers WHERE user_id = ?)`,
      [req.session.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

module.exports = router;
