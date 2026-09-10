const { pool } = require('../config/database');

const webhookController = {
  handleQrisWebhook: async (req, res) => {
    try {
      const payload = req.body;
      const transactionId = payload.transaction_id || payload.data?.transaction_id;
      const status = payload.status || payload.data?.status;

      if (!transactionId || !status) return res.status(400).json({ success: false, message: 'Invalid payload' });

      const txResult = await pool.query('SELECT * FROM transactions WHERE provider_transaction_id = $1', [transactionId]);
      if (txResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Transaction not found' });

      const transaction = txResult.rows[0];
      if (transaction.status !== 'pending') return res.json({ success: true, message: 'Already processed' });

      const validTransitions = { pending: ['success', 'expired', 'failed', 'cancelled'] };
      if (!validTransitions[transaction.status]?.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status transition' });

      await pool.query(
        `UPDATE transactions SET status = $1, paid_at = $2, updated_at = NOW() WHERE id = $3`,
        [status, status === 'success' ? new Date() : null, transaction.id]
      );

      await pool.query(
        `INSERT INTO audit_logs (actor_role, action, target_type, target_id, metadata, ip_address) VALUES ('SYSTEM', 'WEBHOOK_RECEIVED', 'transaction', $1, $2, $3)`,
        [transaction.id, JSON.stringify({ provider_transaction_id: transactionId, status }), req.ip]
      );

      res.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};

module.exports = webhookController;
