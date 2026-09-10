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
const { isAuthenticated, isAdmin, isReseller, isActiveUser } = require('../middleware/auth');
const { rateLimiter, dailyLimitChecker } = require('../middleware/rateLimiter');
const { csrfTokenEndpoint } = require('../middleware/csrf');

// CSRF token endpoint
router.get('/csrf-token', csrfTokenEndpoint);

// Auth routes
router.get('/auth/google', authController.googleLogin);
router.get('/auth/google/callback', authController.googleCallback);
router.get('/auth/me', isAuthenticated, isActiveUser, authController.getCurrentUser);
router.post('/auth/logout', isAuthenticated, authController.logout);

// Payment routes
router.post('/payments/create', isAuthenticated, isActiveUser, rateLimiter, dailyLimitChecker, paymentController.createPayment);
router.get('/payments/:transaction_id/status', isAuthenticated, isActiveUser, paymentController.checkStatus);
router.get('/payments/history', isAuthenticated, isActiveUser, paymentController.getHistory);

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
    const result = await pool.query('SELECT * FROM plans WHERE is_active = true ORDER BY display_order');
    res.json({ success: true, data: result.rows });
  } catch (error) {
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

// Promo routes (Admin only)
router.post('/admin/promos', isAuthenticated, isAdmin, promoController.createPromo);
router.get('/admin/promos', isAuthenticated, isAdmin, promoController.getPromos);
router.put('/admin/promos/:promoId', isAuthenticated, isAdmin, promoController.updatePromo);

// Reseller routes
router.get('/reseller/customers', isAuthenticated, isReseller, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.status, u.last_login, u.created_at
       FROM reseller_users ru
       JOIN users u ON ru.user_id = u.id
       WHERE ru.reseller_id = (SELECT id FROM resellers WHERE user_id = $1)
       ORDER BY u.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

module.exports = router;
