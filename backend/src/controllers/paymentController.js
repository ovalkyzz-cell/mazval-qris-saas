const qrisService = require('../services/qrisService');
const { pool } = require('../config/database');
const { incrementDailyCount } = require('../middleware/rateLimiter');

const paymentController = {
  // Create QRIS transaction
  createPayment: async (req, res) => {
    try {
      const { amount, description, promo_code } = req.body;
      const userId = req.user.id;

      // Validate amount
      if (!amount || isNaN(amount) || amount <= 0 || amount > 100000000) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Invalid amount' }
        });
      }

      // Check promo code if provided
      let discountAmount = 0;
      let promoCodeId = null;
      if (promo_code) {
        const promoResult = await pool.query(
          `SELECT * FROM promo_codes 
           WHERE code = $1 AND status = 'active'
           AND (starts_at IS NULL OR starts_at <= NOW())
           AND (expires_at IS NULL OR expires_at >= NOW())
           AND (max_usage IS NULL OR used_count < max_usage)`,
          [promo_code.toUpperCase()]
        );

        if (promoResult.rows.length > 0) {
          const promo = promoResult.rows[0];
          if (promo.type === 'percentage') {
            discountAmount = Math.floor(amount * promo.value / 100);
          } else {
            discountAmount = Math.min(promo.value, amount);
          }
          promoCodeId = promo.id;
        }
      }

      const finalAmount = amount - discountAmount;

      // Create internal transaction
      const internalTx = await qrisService.createInternalTransaction({
        userId,
        amount: finalAmount,
        description,
        promoCodeId,
        discountAmount
      });

      // Call QRIS API
      const callbackUrl = `${process.env.BACKEND_URL}/api/webhooks/qris`;
      const qrisResponse = await qrisService.createTransaction({
        userId,
        amount: finalAmount,
        description: description || `Payment #${internalTx.id}`,
        callbackUrl
      });

      // Update transaction with QRIS data
      await qrisService.updateTransaction(internalTx.id, {
        provider_transaction_id: qrisResponse.transaction_id,
        qr_url: qrisResponse.qr_url,
        payment_url: qrisResponse.payment_url,
        total_amount: qrisResponse.total_amount,
        expired_at: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      });

      // Increment daily count
      await incrementDailyCount(userId);

      // Log API usage
      await pool.query(
        'INSERT INTO api_usage (user_id, endpoint, method) VALUES ($1, $2, $3)',
        [userId, '/api/payments/create', 'POST']
      );

      res.json({
        success: true,
        data: {
          transaction_id: internalTx.id,
          provider_transaction_id: qrisResponse.transaction_id,
          qr_url: qrisResponse.qr_url,
          qris_image: qrisResponse.qris_image,
          payment_url: qrisResponse.payment_url,
          amount: finalAmount,
          total_amount: qrisResponse.total_amount,
          discount_amount: discountAmount,
          status: 'pending',
          expired_at: internalTx.expired_at
        }
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment' }
      });
    }
  },

  // Check payment status
  checkStatus: async (req, res) => {
    try {
      const { transaction_id } = req.params;
      const userId = req.user.id;

      // Get transaction
      const transaction = await qrisService.getTransaction(transaction_id);
      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transaction not found' }
        });
      }

      // Check ownership
      if (transaction.user_id !== userId && req.user.role_name !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' }
        });
      }

      // If still pending, check with provider
      if (transaction.status === 'pending' && transaction.provider_transaction_id) {
        try {
          const providerStatus = await qrisService.checkStatus(transaction.provider_transaction_id);
          if (providerStatus?.data?.status) {
            const newStatus = providerStatus.data.status;
            if (['success', 'expired', 'failed'].includes(newStatus)) {
              await qrisService.updateTransaction(transaction.id, {
                status: newStatus,
                paid_at: newStatus === 'success' ? new Date() : null
              });
              transaction.status = newStatus;
            }
          }
        } catch (providerError) {
          console.error('Provider status check failed:', providerError);
        }
      }

      res.json({
        success: true,
        data: {
          transaction_id: transaction.id,
          status: transaction.status,
          amount: transaction.amount,
          total_amount: transaction.total_amount,
          qr_url: transaction.qr_url,
          payment_url: transaction.payment_url,
          expired_at: transaction.expired_at,
          paid_at: transaction.paid_at
        }
      });
    } catch (error) {
      console.error('Check status error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  },

  // Get transaction history
  getHistory: async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await qrisService.getUserTransactions(userId, page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      });
    }
  }
};

module.exports = paymentController;
