const { pool } = require('../src/config/database');

const migrations = [
  // Roles table
  `CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar TEXT,
    google_id VARCHAR(255) UNIQUE,
    role_id INTEGER REFERENCES roles(id),
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    last_ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Plans table
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Subscriptions table
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES plans(id),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    expired_at TIMESTAMP,
    custom_rate_limit INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
  );`,

  // Resellers table
  `CREATE TABLE IF NOT EXISTS resellers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    custom_rate_limit INTEGER DEFAULT 300,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Reseller users (customers under reseller)
  `CREATE TABLE IF NOT EXISTS reseller_users (
    id SERIAL PRIMARY KEY,
    reseller_id INTEGER REFERENCES resellers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(reseller_id, user_id)
  );`,

  // Transactions table
  `CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    reseller_id INTEGER REFERENCES resellers(id),
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
    webhook_received_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Webhook events table
  `CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    event_type VARCHAR(50),
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // Promo codes table
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Promo redemptions table
  `CREATE TABLE IF NOT EXISTS promo_redemptions (
    id SERIAL PRIMARY KEY,
    promo_code_id INTEGER REFERENCES promo_codes(id),
    user_id INTEGER REFERENCES users(id),
    transaction_id INTEGER REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // Rate limits tracking table
  `CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    endpoint VARCHAR(255),
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // API usage tracking
  `CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    response_time INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // Daily usage tracking
  `CREATE TABLE IF NOT EXISTS daily_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE DEFAULT CURRENT_DATE,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
  );`,

  // Conversations table
  `CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Messages table
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // Audit logs table
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id),
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // Security events table
  `CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    severity VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // Create indexes
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_transaction_id);`,
  `CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);`,
  `CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);`
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      await client.query(sql);
      console.log('Migration executed successfully');
    }
    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}
