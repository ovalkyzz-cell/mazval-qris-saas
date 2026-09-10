const crypto = require('crypto');
const { pool } = require('../config/database');

const webhookController = {
  // Handle QRIS webhook
  handleQrisWebhook: async (req, res) => {
    try {
      const payload = req.body;

      // Log webhook event
      const webhookResult = await pool.query(
        `INSERT INTO webhook_events (event_type, payload, processed)
         VALUES ('qris_status', $1, false)
         RETURNING id`,
        [JSON.stringify(payload)]
      );
      const webhookId = webhookResult.rows[0].id;

      // Extract transaction info
      const transactionId = payload.transaction_id || payload.data?.transaction_id;
      const status = payload.status || payload.data?.status;

      if (!transactionId || !status) {
        await pool.query(
          'UPDATE webhook_events SET processed = true, payload = payload || $1 WHERE id = $2',
          [JSON.stringify({ error: 'Missing transaction_id or status' }), webhookId]
        );
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }

      // Find transaction
      const txResult = await pool.query(
        'SELECT * FROM transactions WHERE provider_transaction_id = $1',
        [transactionId]
      );

      if (txResult.rows.length === 0) {
        await pool.query(
          'UPDATE webhook_events SET processed = true, payload = payload || $1 WHERE id = $2',
          [JSON.stringify({ error: 'Transaction not found' }), webhookId]
        );
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const transaction = txResult.rows[0];

      // Idempotency check - skip if already processed
      if (transaction.status !== 'pending') {
        await pool.query(
          'UPDATE webhook_events SET processed = true WHERE id = $1',
          [webhookId]
        );
        return res.json({ success: true, message: 'Already processed' });
      }

      // Validate status transition
      const validTransitions = {
        pending: ['success', 'expired', 'failed', 'cancelled']
      };

      if (!validTransitions[transaction.status]?.includes(status)) {
        await pool.query(
          'UPDATE webhook_events SET processed = true, payload = payload || $1 WHERE id = $2',
          [JSON.stringify({ error: 'Invalid status transition' }), webhookId]
        );
        return res.status(400).json({ success: false, message: 'Invalid status transition' });
      }

      // Update transaction
      const updateData = {
        status: status,
        webhook_received_at: new Date()
      };

      if (status === 'success') {
        updateData.paid_at = new Date();
      }

      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
      fields.push('updated_at = NOW()');
      values.push(transaction.id);

      await pool.query(
        `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${paramCount}`,
        values
      );

      // Mark webhook as processed
      await pool.query(
        'UPDATE webhook_events SET processed = true WHERE id = $1',
        [webhookId]
      );

      // Audit log
      await pool.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, ip_address)
         VALUES (NULL, 'SYSTEM', 'WEBHOOK_RECEIVED', 'transaction', $1, $2, $3)`,
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
