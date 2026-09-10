require('dotenv').config();
const { pool } = require('../src/config/database');

const migrations = [
  `CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    avatar TEXT,
    google_id VARCHAR(255),
    role_id INTEGER REFERENCES roles(id),
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    price INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 5,
    rate_limit INTEGER DEFAULT 5,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    badge VARCHAR(50),
    marketing_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES plans(id),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    expired_at TIMESTAMP,
    custom_rate_limit INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    provider_transaction_id VARCHAR(100),
    amount INTEGER NOT NULL,
    total_amount INTEGER,
    description TEXT,
    qris_method VARCHAR(50) DEFAULT 'qris_two',
    qr_url TEXT,
    payment_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    promo_code_id INTEGER,
    discount_amount INTEGER DEFAULT 0,
    expired_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS daily_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE DEFAULT CURRENT_DATE,
    transaction_count INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    value INTEGER NOT NULL,
    max_usage INTEGER,
    used_count INTEGER DEFAULT 0,
    minimum_amount INTEGER DEFAULT 0,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER,
    actor_role TEXT,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS resellers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    business_name VARCHAR(255),
    contact_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    custom_rate_limit INTEGER DEFAULT 300,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`
];

const seeds = [
  `INSERT INTO roles (name, description, permissions) VALUES 
    ('ADMIN', 'System administrator', '["*"]'),
    ('RESELLER', 'Reseller account', '["manage_customers","view_transactions"]'),
    ('USER', 'Regular user', '["create_payment","view_history","manage_profile"]')
   ON CONFLICT (name) DO NOTHING`,
  `INSERT INTO plans (name, slug, price, daily_limit, rate_limit, features, display_order, badge, marketing_text) VALUES
    ('Free', 'free', 0, 5, 5, '["QRIS Payment","Generate QR","Payment URL"]', 1, NULL, 'Mulai gratis'),
    ('Basic', 'basic', 10000, 100, 30, '["Semua fitur Free","API Access"]', 2, NULL, 'Cocok untuk pengguna serius'),
    ('Pro', 'pro', 25000, 500, 120, '["Semua fitur Basic","Webhook","Analytics"]', 3, '🔥 MOST POPULAR', 'Cocok untuk bisnis berkembang'),
    ('Business', 'business', 35000, 2000, 300, '["Semua fitur Pro","Custom Rate Limit"]', 4, '👑 BEST FOR BUSINESS', 'Cocok untuk traffic tinggi'),
    ('Reseller', 'reseller', 35000, 2000, 300, '["Reseller Dashboard","Customer Management"]', 5, '🚀 FOR RESELLERS', 'Kelola multiple customer')
   ON CONFLICT (slug) DO NOTHING`
];

async function migrate() {
  try {
    console.log('Running migrations...');
    for (const sql of migrations) {
      await pool.query(sql);
      console.log('✓ Migration applied');
    }
    
    console.log('Running seeds...');
    for (const sql of seeds) {
      await pool.query(sql);
    }
    console.log('✓ Seeds applied');
    
    // Create admin user
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role_id, status) 
       SELECT 'admin@mazval.com', 'Admin', $1, 1, 'active'
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@mazval.com')`,
      [hash]
    );
    
    // Create free subscription for admin
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at)
       SELECT 1, 3, 'active', NOW(), NOW() + INTERVAL '100 years'
       WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = 1)`
    );
    
    console.log('✓ Admin user created');
    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
