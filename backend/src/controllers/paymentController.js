const qrisService = require('../services/qrisService');
const { pool } = require('../config/database');
const { incrementDailyCount, getDailyLimit, getTodayTransactionCount } = require('../middleware/rateLimiter');

const paymentController = {
  createPayment: async (req, res) => {
    try {
      const { amount, description, promo_code } = req.body;
      const userId = req.session.userId;

      if (!amount || isNaN(amount) || amount <= 0 || amount > 100000000) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Invalid amount' } });
      }

      const dailyLimit = await getDailyLimit(userId);
      const todayCount = await getTodayTransactionCount(userId);
      if (todayCount >= dailyLimit) {
        return res.status(403).json({ success: false, error: { code: 'DAILY_LIMIT_EXCEEDED', message: 'Daily limit exceeded' } });
      }

      let discountAmount = 0;
      let promoCodeId = null;
      if (promo_code) {
        const promoResult = await pool.query(
          `SELECT * FROM promo_codes WHERE code = $1 AND status = 'active' AND (max_usage IS NULL OR used_count < max_usage)`,
          [promo_code.toUpperCase()]
        );
        if (promoResult.rows.length > 0) {
          const promo = promoResult.rows[0];
          discountAmount = promo.type === 'percentage' ? Math.floor(amount * promo.value / 100) : Math.min(promo.value, amount);
          promoCodeId = promo.id;
        }
      }

      const finalAmount = amount - discountAmount;
      const internalTx = await qrisService.createInternalTransaction({ userId, amount: finalAmount, description, promoCodeId, discountAmount });
      const qrisResponse = await qrisService.createTransaction({ userId, amount: finalAmount, description: description || `Payment #${internalTx.id}`, callbackUrl: `${process.env.BACKEND_URL}/api/webhooks/qris` });

      await qrisService.updateTransaction(internalTx.id, {
        provider_transaction_id: qrisResponse.transaction_id,
        qr_url: qrisResponse.qr_url,
        payment_url: qrisResponse.payment_url,
        total_amount: qrisResponse.total_amount,
        expired_at: new Date(Date.now() + 15 * 60 * 1000)
      });

      await incrementDailyCount(userId);

      res.json({
        success: true,
        data: {
          transaction_id: internalTx.id, provider_transaction_id: qrisResponse.transaction_id,
          qr_url: qrisResponse.qr_url, qris_image: qrisResponse.qris_image, payment_url: qrisResponse.payment_url,
          amount: finalAmount, total_amount: qrisResponse.total_amount, discount_amount: discountAmount,
          status: 'pending', expired_at: new Date(Date.now() + 15 * 60 * 1000)
        }
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment' } });
    }
  },

  checkStatus: async (req, res) => {
    try {
      const { transaction_id } = req.params;
      const userId = req.session.userId;
      const transaction = await qrisService.getTransaction(transaction_id);
      if (!transaction) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
      if (transaction.user_id !== userId) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });

      if (transaction.status === 'pending' && transaction.provider_transaction_id) {
        try {
          const providerStatus = await qrisService.checkStatus(transaction.provider_transaction_id);
          if (providerStatus?.data?.status && ['success', 'expired', 'failed'].includes(providerStatus.data.status)) {
            await qrisService.updateTransaction(transaction.id, { status: providerStatus.data.status, paid_at: providerStatus.data.status === 'success' ? new Date() : null });
            transaction.status = providerStatus.data.status;
          }
        } catch (e) { console.error('Provider check failed:', e); }
      }

      res.json({
        success: true,
        data: { transaction_id: transaction.id, status: transaction.status, amount: transaction.amount, total_amount: transaction.total_amount, qr_url: transaction.qr_url, payment_url: transaction.payment_url, expired_at: transaction.expired_at, paid_at: transaction.paid_at }
      });
    } catch (error) {
      console.error('Check status error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  },

  getHistory: async (req, res) => {
    try {
      const result = await qrisService.getUserTransactions(req.session.userId, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  }
};

module.exports = paymentController;
