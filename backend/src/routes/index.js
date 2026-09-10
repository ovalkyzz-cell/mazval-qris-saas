const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const authController = require('../controllers/authController');
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');
const adminController = require('../controllers/adminController');
const chatController = require('../controllers/chatController');
const promoController = require('../controllers/promoController');
const { rateLimiter, dailyLimitChecker } = require('../middleware/rateLimiter');

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please login' } });
};

const isAdmin = async (req, res, next) => {
  try {
    const { pool } = require('../config/database');
    const result = await pool.query('SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [req.session.userId]);
    if (result.rows[0]?.name === 'ADMIN') return next();
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
};

const isReseller = async (req, res, next) => {
  try {
    const { pool } = require('../config/database');
    const result = await pool.query('SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [req.session.userId]);
    if (result.rows[0]?.name === 'RESELLER' || result.rows[0]?.name === 'ADMIN') return next();
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Reseller access required' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
};

// Migration endpoint (protected)
router.get('/setup/migrate', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    
    await pool.query(`CREATE TABLE IF NOT EXISTS user_sessions (sid VARCHAR NOT NULL COLLATE "default", sess JSONB NOT NULL, expire TIMESTAMP(6) NOT NULL, PRIMARY KEY (sid))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS IDX_user_sessions_expire ON user_sessions(expire)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE NOT NULL, description TEXT, permissions JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255), password_hash VARCHAR(255), avatar TEXT, google_id VARCHAR(255), role_id INTEGER REFERENCES roles(id), status VARCHAR(20) DEFAULT 'active', last_login TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS plans (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, slug VARCHAR(100) UNIQUE NOT NULL, price INTEGER DEFAULT 0, daily_limit INTEGER DEFAULT 5, rate_limit INTEGER DEFAULT 5, features JSONB DEFAULT '[]', is_active BOOLEAN DEFAULT true, display_order INTEGER DEFAULT 0, badge VARCHAR(50), marketing_text TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS subscriptions (id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE REFERENCES users(id), plan_id INTEGER REFERENCES plans(id), status VARCHAR(20) DEFAULT 'active', started_at TIMESTAMP DEFAULT NOW(), expired_at TIMESTAMP, custom_rate_limit INTEGER)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), provider_transaction_id VARCHAR(100), amount INTEGER NOT NULL, total_amount INTEGER, description TEXT, qr_url TEXT, payment_url TEXT, status VARCHAR(20) DEFAULT 'pending', discount_amount INTEGER DEFAULT 0, expired_at TIMESTAMP, paid_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS daily_usage (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), date DATE DEFAULT CURRENT_DATE, transaction_count INTEGER DEFAULT 0, UNIQUE(user_id, date))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS promo_codes (id SERIAL PRIMARY KEY, code VARCHAR(50) UNIQUE NOT NULL, type VARCHAR(20) NOT NULL, value INTEGER NOT NULL, max_usage INTEGER, used_count INTEGER DEFAULT 0, status VARCHAR(20) DEFAULT 'active', created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, actor_id INTEGER, actor_role TEXT, action VARCHAR(100) NOT NULL, target_type VARCHAR(50), target_id INTEGER, metadata JSONB, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS resellers (id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE REFERENCES users(id), business_name VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', custom_rate_limit INTEGER DEFAULT 300, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS reseller_users (id SERIAL PRIMARY KEY, reseller_id INTEGER REFERENCES resellers(id), user_id INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title VARCHAR(255) DEFAULT 'New Chat', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, conversation_id INTEGER REFERENCES conversations(id), role VARCHAR(20) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);

    // Seed roles
    await pool.query(`INSERT INTO roles (name, description, permissions) VALUES ('ADMIN', 'System administrator', '["*"]'), ('RESELLER', 'Reseller', '["manage_customers"]'), ('USER', 'User', '["create_payment"]') ON CONFLICT (name) DO NOTHING`);
    
    // Seed plans
    await pool.query(`INSERT INTO plans (name, slug, price, daily_limit, rate_limit, features, display_order, badge, marketing_text) VALUES
      ('Free', 'free', 0, 5, 5, '["QRIS Payment","Generate QR"]', 1, NULL, 'Mulai gratis'),
      ('Basic', 'basic', 10000, 100, 30, '["Semua fitur Free","API Access"]', 2, NULL, 'Cocok untuk serius'),
      ('Pro', 'pro', 25000, 500, 120, '["Semua Basic","Webhook","Analytics"]', 3, '🔥 MOST POPULAR', 'Bisnis berkembang'),
      ('Business', 'business', 35000, 2000, 300, '["Semua Pro","Custom Rate Limit"]', 4, '👑 BEST FOR BUSINESS', 'Traffic tinggi'),
      ('Reseller', 'reseller', 35000, 2000, 300, '["Reseller Dashboard"]', 5, '🚀 FOR RESELLERS', 'Multiple customer')
    ON CONFLICT (slug) DO NOTHING`);

    // Create admin
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(`INSERT INTO users (email, name, password_hash, role_id, status) SELECT 'admin@mazval.com', 'Admin', $1, 1, 'active' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@mazval.com')`, [hash]);
    await pool.query(`INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at) SELECT 1, 3, 'active', NOW(), NOW() + INTERVAL '100 years' WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = 1)`);

    res.json({ success: true, message: 'Migration complete!' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auth
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authController.getCurrentUser);
router.post('/auth/logout', isAuthenticated, authController.logout);

// Payments
router.post('/payments/create', isAuthenticated, rateLimiter, dailyLimitChecker, paymentController.createPayment);
router.get('/payments/:transaction_id/status', isAuthenticated, paymentController.checkStatus);
router.get('/payments/history', isAuthenticated, paymentController.getHistory);

// Chat
router.get('/chat/conversations', isAuthenticated, chatController.getConversations);
router.post('/chat/conversations', isAuthenticated, chatController.createConversation);
router.get('/chat/conversations/:conversationId/messages', isAuthenticated, chatController.getMessages);
router.post('/chat/conversations/:conversationId/messages', isAuthenticated, chatController.sendMessage);
router.put('/chat/conversations/:conversationId', isAuthenticated, chatController.updateConversation);
router.delete('/chat/conversations/:conversationId', isAuthenticated, chatController.deleteConversation);

// Public
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
router.post('/webhooks/qris', webhookController.handleQrisWebhook);

// Admin
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

// Reseller
router.get('/reseller/customers', isAuthenticated, isReseller, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const result = await pool.query(`SELECT u.id, u.email, u.name, u.status, u.last_login, u.created_at FROM reseller_users ru JOIN users u ON ru.user_id = u.id WHERE ru.reseller_id = (SELECT id FROM resellers WHERE user_id = $1)`, [req.session.userId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

module.exports = router;
