const axios = require('axios');
const { pool } = require('../config/database');

const QRIS_BASE_URL = 'https://api.buatqris.site';

class QrisService {
  async createTransaction({ userId, amount, description }) {
    const account_id = process.env.QRIS_ACCOUNT_ID;
    const secret_token = process.env.QRIS_SECRET_TOKEN;

    if (!account_id || !secret_token) {
      throw new Error('QRIS credentials not configured');
    }

    const params = new URLSearchParams();
    params.append('action', 'api_create_qris');
    params.append('account_id', account_id);
    params.append('secret_token', secret_token);
    params.append('amount', String(amount));
    params.append('description', description || 'Pembayaran MazzVal');
    params.append('qris_method', 'qris_two');
    params.append('fee_by', 'buyer');

    try {
      const response = await axios.post(QRIS_BASE_URL, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Gagal membuat transaksi QRIS');
      }

      return {
        transaction_id: response.data.data.transaction_id,
        qr_url: response.data.data.qr_url,
        qris_image: response.data.data.qris_image,
        payment_url: response.data.data.payment_url,
        amount: response.data.data.amount,
        total_amount: response.data.data.total_amount,
        status: response.data.data.status
      };
    } catch (error) {
      console.error('QRIS create error:', error.message);
      throw error;
    }
  }

  async checkStatus(transactionId) {
    const account_id = process.env.QRIS_ACCOUNT_ID;
    const secret_token = process.env.QRIS_SECRET_TOKEN;

    const params = new URLSearchParams();
    params.append('action', 'api_check_status');
    params.append('account_id', account_id);
    params.append('secret_token', secret_token);
    params.append('transaction_id', transactionId);

    try {
      const response = await axios.post(QRIS_BASE_URL, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('QRIS check error:', error.message);
      throw error;
    }
  }

  async createInternalTransaction({ userId, amount, description, promoCodeId, discountAmount }) {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, amount, description, status, promo_code_id, discount_amount)
       VALUES ($1, $2, $3, 'pending', $4, $5) RETURNING *`,
      [userId, amount, description, promoCodeId || null, discountAmount || 0]
    );
    return result.rows[0];
  }

  async updateTransaction(transactionId, data) {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    fields.push('updated_at = NOW()');
    values.push(transactionId);
    await pool.query(`UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i}`, values);
  }

  async getTransaction(id) {
    const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getUserTransactions(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    const countResult = await pool.query('SELECT COUNT(*) FROM transactions WHERE user_id = $1', [userId]);
    return { transactions: result.rows, total: parseInt(countResult.rows[0].count), page, limit };
  }
}

module.exports = new QrisService();
