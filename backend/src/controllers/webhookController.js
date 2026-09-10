const { pool } = require('../config/database');

const webhookController = {
  // Handle QRIS webhook
  handleQrisWebhook: async (req, res) => {
    try {
      const payload = req.body;

      // Extract transaction info
      const transactionId = payload.transaction_id || payload.data?.transaction_id;
      const status = payload.status || payload.data?.status;

      if (!transactionId || !status) {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }

      // Find transaction
      const txResult = pool.query(
        'SELECT * FROM transactions WHERE provider_transaction_id = ?',
        [transactionId]
      );

      if (txResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const transaction = txResult.rows[0];

      // Idempotency check
      if (transaction.status !== 'pending') {
        return res.json({ success: true, message: 'Already processed' });
      }

      // Validate status transition
      const validTransitions = {
        pending: ['success', 'expired', 'failed', 'cancelled']
      };

      if (!validTransitions[transaction.status]?.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status transition' });
      }

      // Update transaction
      const updateFields = {
        status: status,
        updated_at: new Date().toISOString()
      };

      if (status === 'success') {
        updateFields.paid_at = new Date().toISOString();
      }

      pool.query(
        `UPDATE transactions SET status = ?, paid_at = ?, updated_at = datetime('now') WHERE id = ?`,
        [updateFields.status, updateFields.paid_at || null, transaction.id]
      );

      // Audit log
      pool.query(
        "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address) VALUES (NULL, 'SYSTEM', 'WEBHOOK_RECEIVED', 'transaction', ?, ?, ?)",
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
