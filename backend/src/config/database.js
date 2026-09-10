const { Pool } = require('pg');
const sqlite3 = require('better-sqlite3');
const path = require('path');

// Use SQLite for serverless/Vercel (no external DB needed)
const dbPath = path.join(__dirname, '../../data.db');
let sqliteDb;

function getSqliteDb() {
  if (!sqliteDb) {
    sqliteDb = sqlite3(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    initSqliteTables();
  }
  return sqliteDb;
}

function initSqliteTables() {
  const db = getSqliteDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      avatar TEXT,
      google_id TEXT,
      role_id INTEGER DEFAULT 3,
      status TEXT DEFAULT 'active',
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      price INTEGER DEFAULT 0,
      daily_limit INTEGER DEFAULT 5,
      rate_limit INTEGER DEFAULT 5,
      features TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      badge TEXT,
      marketing_text TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      plan_id INTEGER,
      status TEXT DEFAULT 'active',
      started_at TEXT,
      expired_at TEXT,
      custom_rate_limit INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      provider_transaction_id TEXT,
      amount INTEGER NOT NULL,
      total_amount INTEGER,
      description TEXT,
      qris_method TEXT DEFAULT 'qris_two',
      qr_url TEXT,
      payment_url TEXT,
      status TEXT DEFAULT 'pending',
      promo_code_id INTEGER,
      discount_amount INTEGER DEFAULT 0,
      expired_at TEXT,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      date TEXT,
      transaction_count INTEGER DEFAULT 0,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      value INTEGER NOT NULL,
      max_usage INTEGER,
      used_count INTEGER DEFAULT 0,
      minimum_amount INTEGER DEFAULT 0,
      starts_at TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'active',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_role TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      business_name TEXT,
      contact_email TEXT,
      status TEXT DEFAULT 'pending',
      custom_rate_limit INTEGER DEFAULT 300,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default data
  const existingRoles = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (existingRoles.count === 0) {
    db.prepare('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)').run('ADMIN', 'System administrator', '["*"]');
    db.prepare('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)').run('RESELLER', 'Reseller account', '["manage_customers","view_transactions"]');
    db.prepare('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)').run('USER', 'Regular user', '["create_payment","view_history","manage_profile"]');
  }

  const existingPlans = db.prepare('SELECT COUNT(*) as count FROM plans').get();
  if (existingPlans.count === 0) {
    const plans = [
      ['Free', 'free', 0, 5, 5, '["QRIS Payment","Generate QR","Payment URL","Status Pembayaran","Riwayat Transaksi","Dashboard Dasar"]', 1, null, 'Mulai gratis tanpa kartu kredit'],
      ['Basic', 'basic', 10000, 100, 30, '["Semua fitur Free","QRIS Payment","QR Code Otomatis","API Access","Transaction Monitoring","Standard Support"]', 2, null, 'Cocok untuk pengguna serius'],
      ['Pro', 'pro', 25000, 500, 120, '["Semua fitur Basic","Webhook","Advanced Analytics","API Usage Monitoring","Export Transaksi","Priority Support"]', 3, '🔥 MOST POPULAR', 'Cocok untuk bisnis berkembang'],
      ['Business', 'business', 35000, 2000, 300, '["Semua fitur Pro","Reseller Ready","Multi Customer","Advanced API Monitoring","Custom Rate Limit","Priority+ Support"]', 4, '👑 BEST FOR BUSINESS', 'Cocok untuk traffic tinggi'],
      ['Reseller', 'reseller', 35000, 2000, 300, '["Reseller Dashboard","Customer Management","Transaction Monitoring","API Usage","Rate Limit Monitoring"]', 5, '🚀 FOR RESELLERS', 'Kelola multiple customer']
    ];
    
    const stmt = db.prepare('INSERT INTO plans (name, slug, price, daily_limit, rate_limit, features, display_order, badge, marketing_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const plan of plans) {
      stmt.run(...plan);
    }
  }

  // Create default admin
  const existingAdmin = db.prepare("SELECT COUNT(*) as count FROM users WHERE email = 'admin@mazval.com'").get();
  if (existingAdmin.count === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (email, name, password_hash, role_id, status) VALUES (?, ?, ?, 1, ?)').run('admin@mazval.com', 'Admin', hash, 'active');
  }
}

// Query helper that mimics pg pool.query
const query = (text, params = []) => {
  const db = getSqliteDb();
  
  // Convert PostgreSQL style queries to SQLite
  let sql = text.replace(/\$1/g, '?').replace(/\$2/g, '?').replace(/\$3/g, '?').replace(/\$4/g, '?').replace(/\$5/g, '?').replace(/\$6/g, '?').replace(/\$7/g, '?');
  
  try {
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
      const rows = db.prepare(sql).all(...params);
      return { rows, rowCount: rows.length };
    } else {
      const result = db.prepare(sql).run(...params);
      return { rows: [{ id: result.lastInsertRowid }], rowCount: result.changes };
    }
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

const getClient = () => ({
  query,
  release: () => {}
});

module.exports = { pool: { query, connect: getClient, end: () => {} }, query, getClient, getSqliteDb };
