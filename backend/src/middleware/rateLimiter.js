const { pool } = require('../config/database');

const RATE_LIMITS = { free: 5, basic: 30, pro: 120, business: 300, reseller: 300 };
const DAILY_LIMITS = { free: 5, basic: 100, pro: 500, business: 2000, reseller: 2000 };

const rateLimitStore = new Map();

async function getUserRateLimit(userId) {
  try {
    const result = await pool.query(
      `SELECT s.custom_rate_limit, p.rate_limit, p.slug as plan_slug
       FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.user_id = $1 AND s.status = 'active'`,
      [userId]
    );
    if (result.rows.length === 0) return RATE_LIMITS.free;
    const sub = result.rows[0];
    return sub.custom_rate_limit || RATE_LIMITS[sub.plan_slug] || RATE_LIMITS.free;
  } catch { return RATE_LIMITS.free; }
}

async function getDailyLimit(userId) {
  try {
    const result = await pool.query(
      `SELECT p.daily_limit, p.slug as plan_slug
       FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.user_id = $1 AND s.status = 'active'`,
      [userId]
    );
    if (result.rows.length === 0) return DAILY_LIMITS.free;
    return DAILY_LIMITS[result.rows[0].plan_slug] || DAILY_LIMITS.free;
  } catch { return DAILY_LIMITS.free; }
}

async function getTodayTransactionCount(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query('SELECT transaction_count FROM daily_usage WHERE user_id = $1 AND date = $2', [userId, today]);
    return result.rows[0]?.transaction_count || 0;
  } catch { return 0; }
}

async function incrementDailyCount(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO daily_usage (user_id, date, transaction_count) VALUES ($1, $2, 1)
       ON CONFLICT (user_id, date) DO UPDATE SET transaction_count = daily_usage.transaction_count + 1`,
      [userId, today]
    );
  } catch (error) { console.error('Increment daily count error:', error); }
}

const rateLimiter = async (req, res, next) => {
  if (!req.session?.userId) return next();
  const userId = req.session.userId;
  const rateLimit = await getUserRateLimit(userId);
  const key = `${userId}:${Math.floor(Date.now() / 60000)}`;
  const current = rateLimitStore.get(key) || 0;

  if (current >= rateLimit) {
    res.set('Retry-After', '60');
    return res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' } });
  }

  rateLimitStore.set(key, current + 1);
  if (rateLimitStore.size > 10000) {
    const now = Math.floor(Date.now() / 60000);
    for (const [k] of rateLimitStore) {
      if (now - parseInt(k.split(':')[1]) > 5) rateLimitStore.delete(k);
    }
  }

  res.set('X-RateLimit-Limit', rateLimit);
  res.set('X-RateLimit-Remaining', rateLimit - current - 1);
  next();
};

const dailyLimitChecker = async (req, res, next) => {
  if (!req.session?.userId) return next();
  const userId = req.session.userId;
  const dailyLimit = await getDailyLimit(userId);
  const todayCount = await getTodayTransactionCount(userId);

  if (todayCount >= dailyLimit) {
    return res.status(403).json({
      success: false,
      error: { code: 'DAILY_LIMIT_EXCEEDED', message: 'Daily limit exceeded', current: todayCount, limit: dailyLimit }
    });
  }
  req.dailyLimit = { current: todayCount, limit: dailyLimit };
  next();
};

module.exports = { rateLimiter, dailyLimitChecker, getUserRateLimit, getDailyLimit, getTodayTransactionCount, incrementDailyCount, RATE_LIMITS, DAILY_LIMITS };
