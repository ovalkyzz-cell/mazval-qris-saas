const { pool } = require('../src/config/database');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Seed roles
    const roles = [
      { name: 'ADMIN', description: 'System administrator', permissions: ['*'] },
      { name: 'RESELLER', description: 'Reseller account', permissions: ['manage_customers', 'view_transactions', 'view_analytics'] },
      { name: 'USER', description: 'Regular user', permissions: ['create_payment', 'view_history', 'manage_profile'] }
    ];

    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (name, description, permissions) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO NOTHING`,
        [role.name, role.description, JSON.stringify(role.permissions)]
      );
    }
    console.log('Roles seeded');

    // Seed plans
    const plans = [
      {
        name: 'Free',
        slug: 'free',
        price: 0,
        daily_limit: 5,
        rate_limit: 5,
        features: ['QRIS Payment', 'Generate QR', 'Payment URL', 'Status Pembayaran', 'Riwayat Transaksi', 'Dashboard Dasar', 'Google Login', 'Support Basic'],
        display_order: 1,
        badge: null,
        marketing_text: 'Mulai gratis tanpa kartu kredit'
      },
      {
        name: 'Basic',
        slug: 'basic',
        price: 10000,
        daily_limit: 100,
        rate_limit: 30,
        features: ['Semua fitur Free', 'QRIS Payment', 'QR Code Otomatis', 'Payment URL', 'Status Pembayaran', 'Riwayat Transaksi', 'Dashboard Statistik', 'API Access', 'Transaction Monitoring', 'Standard Support'],
        display_order: 2,
        badge: null,
        marketing_text: 'Cocok untuk pengguna yang ingin mulai menggunakan QRIS secara serius dengan biaya sangat terjangkau'
      },
      {
        name: 'Pro',
        slug: 'pro',
        price: 25000,
        daily_limit: 500,
        rate_limit: 120,
        features: ['Semua fitur Basic', 'Webhook', 'Advanced Analytics', 'API Usage Monitoring', 'Export Transaksi', 'Statistik Lengkap', 'Prioritas API', 'Priority Support', 'Monitoring Detail', 'Cocok untuk Website', 'Cocok untuk Aplikasi', 'Cocok untuk Bot', 'Cocok untuk Bisnis Online'],
        display_order: 3,
        badge: '🔥 MOST POPULAR',
        marketing_text: 'Cocok untuk bisnis yang mulai berkembang dan membutuhkan API lebih cepat serta monitoring pembayaran yang lebih lengkap'
      },
      {
        name: 'Business',
        slug: 'business',
        price: 35000,
        daily_limit: 2000,
        rate_limit: 300,
        features: ['Semua fitur Pro', 'Reseller Ready', 'Multi Customer', 'Advanced API Monitoring', 'Advanced Analytics', 'Custom Rate Limit', 'Priority Processing', 'Priority+ Support', 'Export Transaksi', 'Traffic Tinggi', 'Customer Management', 'Cocok untuk Platform', 'Cocok untuk Bisnis Banyak User'],
        display_order: 4,
        badge: '👑 BEST FOR BUSINESS',
        marketing_text: 'Cocok untuk bisnis, platform, dan pengguna dengan traffic tinggi yang membutuhkan kapasitas API lebih besar'
      },
      {
        name: 'Reseller',
        slug: 'reseller',
        price: 35000,
        daily_limit: 2000,
        rate_limit: 300,
        features: ['Reseller Dashboard', 'Customer Management', 'Create Customer', 'Manage Customer', 'Transaction Monitoring', 'API Usage', 'Rate Limit Monitoring', 'Customer Status', 'Customer Activity', 'Dashboard Statistik', 'Customer Transaction History', 'Customer Subscription Info'],
        display_order: 5,
        badge: '🚀 FOR RESELLERS',
        marketing_text: 'Akses reseller untuk mengelola multiple customer dan bisnis Anda'
      }
    ];

    for (const plan of plans) {
      await client.query(
        `INSERT INTO plans (name, slug, price, daily_limit, rate_limit, features, display_order, badge, marketing_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (slug) DO UPDATE SET
         name = $1, price = $3, daily_limit = $4, rate_limit = $5, features = $6, display_order = $7, badge = $8, marketing_text = $9`,
        [plan.name, plan.slug, plan.price, plan.daily_limit, plan.rate_limit, JSON.stringify(plan.features), plan.display_order, plan.badge, plan.marketing_text]
      );
    }
    console.log('Plans seeded');

    // Create default admin user
    const adminRole = await client.query("SELECT id FROM roles WHERE name = 'ADMIN'");
    if (adminRole.rows.length > 0) {
      await client.query(
        `INSERT INTO users (email, name, role_id, status)
         VALUES ('admin@mazval.com', 'Admin', $1, 'active')
         ON CONFLICT (email) DO NOTHING`,
        [adminRole.rows[0].id]
      );
    }
    console.log('Admin user seeded');

    await client.query('COMMIT');
    console.log('Seed completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { seed };

if (require.main === module) {
  seed().then(() => process.exit(0));
}
