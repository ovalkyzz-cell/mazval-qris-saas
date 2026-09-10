const crypto = require('crypto');
const { pool } = require('../config/database');

const WEBHOOK_SECRET = process.env.QRIS_WEBHOOK_SECRET || 'whsec_3fd18c3175e2ba823656ef5f9cd6f6ca82aaeee9cc1961ce';

const webhookController = {
  handleQrisWebhook: async (req, res) => {
    try {
      const payload = req.body;
      const event = req.headers['x-buatqris-event'] || payload.event;
      const delivery = req.headers['x-buatqris-delivery'] || payload.transaction_id;
      const signature = req.headers['x-buatqris-signature'] || '';

      console.log('Webhook received:', { event, delivery, signature: signature.substring(0, 20) + '...' });

      // Verify signature
      if (WEBHOOK_SECRET && signature) {
        const body = JSON.stringify(payload);
        const expectedSig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
          console.error('Invalid webhook signature');
          return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
      }

      // Handle payment events
      if (event === 'payment.success') {
        const { transaction_id, status, amount, total_amount, credit_amount, admin_fee, paid_at } = payload;

        const txResult = await pool.query(
          'SELECT * FROM transactions WHERE provider_transaction_id = $1',
          [transaction_id]
        );

        if (txResult.rows.length === 0) {
          console.log('Transaction not found:', transaction_id);
          return res.status(200).json({ success: true, message: 'Transaction not found, skipping' });
        }

        const transaction = txResult.rows[0];
        if (transaction.status === 'success') {
          return res.json({ success: true, message: 'Already processed' });
        }

        // Update transaction
        await pool.query(
          `UPDATE transactions SET status = 'success', paid_at = $1, updated_at = NOW() WHERE id = $2`,
          [paid_at ? new Date(paid_at) : new Date(), transaction.id]
        );

        // Update user subscription if it's a plan purchase
        if (transaction.plan_id) {
          await pool.query(
            `INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at)
             VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days')
             ON CONFLICT (user_id) DO UPDATE SET plan_id = $2, status = 'active', expired_at = NOW() + INTERVAL '30 days'`,
            [transaction.user_id, transaction.plan_id]
          );
        }

        // Update daily usage
        await pool.query(
          `INSERT INTO daily_usage (user_id, date, transaction_count) VALUES ($1, CURRENT_DATE, 1)
           ON CONFLICT (user_id, date) DO UPDATE SET transaction_count = daily_usage.transaction_count + 1`,
          [transaction.user_id]
        );

        // Audit log
        await pool.query(
          `INSERT INTO audit_logs (actor_role, action, target_type, target_id, metadata, ip_address)
           VALUES ('SYSTEM', 'PAYMENT_SUCCESS', 'transaction', $1, $2, $3)`,
          [transaction.id, JSON.stringify({ provider_transaction_id: transaction_id, amount, total_amount, credit_amount, admin_fee }), req.ip]
        );

        console.log('Payment success:', transaction_id);
      }

      // Handle expired/failed events
      if (event === 'payment.expired' || event === 'payment.failed') {
        const { transaction_id, status } = payload;

        await pool.query(
          `UPDATE transactions SET status = $1, updated_at = NOW() WHERE provider_transaction_id = $2`,
          [status, transaction_id]
        );

        console.log('Payment', status + ':', transaction_id);
      }

      res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(200).json({ success: true, message: 'Error logged' });
    }
  }
};

module.exports = webhookController;
