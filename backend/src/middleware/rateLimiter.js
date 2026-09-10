const { pool } = require('../config/database');

// Rate limit configuration per plan
const RATE_LIMITS = {
  free: 5,
  basic: 30,
  pro: 120,
  business: 300,
  reseller: 300
};

// Daily transaction limits
const DAILY_LIMITS = {
  free: 5,
  basic: 100,
  pro: 500,
  business: 2000,
  reseller: 2000
};

// Simple in-memory rate limiting (for serverless)
const rateLimitStore = new Map();

// Get user's effective rate limit
async function getUserRateLimit(userId) {
  try {
    const subResult = pool.query(
      `SELECT s.custom_rate_limit, p.rate_limit, p.slug as plan_slug
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = ? AND s.status = 'active'`,
      [userId]
    );

    if (subResult.rows.length === 0) {
      return RATE_LIMITS.free;
    }

    const sub = subResult.rows[0];
    if (sub.custom_rate_limit) {
      return sub.custom_rate_limit;
    }

    return RATE_LIMITS[sub.plan_slug] || RATE_LIMITS.free;
  } catch (error) {
    console.error('Error getting rate limit:', error);
    return RATE_LIMITS.free;
  }
}

// Get user's daily transaction limit
async function getDailyLimit(userId) {
  try {
    const subResult = pool.query(
      `SELECT p.daily_limit, p.slug as plan_slug
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = ? AND s.status = 'active'`,
      [userId]
    );

    if (subResult.rows.length === 0) {
      return DAILY_LIMITS.free;
    }

    return DAILY_LIMITS[subResult.rows[0].plan_slug] || DAILY_LIMITS.free;
  } catch (error) {
    console.error('Error getting daily limit:', error);
    return DAILY_LIMITS.free;
  }
}

// Get today's transaction count
async function getTodayTransactionCount(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = pool.query(
      'SELECT transaction_count FROM daily_usage WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    return result.rows[0]?.transaction_count || 0;
  } catch (error) {
    console.error('Error getting daily count:', error);
    return 0;
  }
}

// Increment daily transaction count
async function incrementDailyCount(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = pool.query(
      'SELECT id FROM daily_usage WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (existing.rows.length > 0) {
      pool.query(
        'UPDATE daily_usage SET transaction_count = transaction_count + 1 WHERE user_id = ? AND date = ?',
        [userId, today]
      );
    } else {
      pool.query(
        'INSERT INTO daily_usage (user_id, date, transaction_count) VALUES (?, ?, 1)',
        [userId, today]
      );
    }
  } catch (error) {
    console.error('Error incrementing daily count:', error);
  }
}

// Rate limiting middleware
const rateLimiter = async (req, res, next) => {
  if (!req.session?.userId) {
    return next();
  }

  const userId = req.session.userId;
  const rateLimit = await getUserRateLimit(userId);
  const key = `${userId}:${Math.floor(Date.now() / 60000)}`;

  try {
    const current = rateLimitStore.get(key) || 0;

    if (current >= rateLimit) {
      res.set('Retry-After', '60');
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryAfter: 60
        }
      });
    }

    rateLimitStore.set(key, current + 1);

    // Clean old entries
    if (rateLimitStore.size > 10000) {
      const now = Math.floor(Date.now() / 60000);
      for (const [k] of rateLimitStore) {
        const keyTime = parseInt(k.split(':')[1]);
        if (now - keyTime > 5) {
          rateLimitStore.delete(k);
        }
      }
    }

    res.set('X-RateLimit-Limit', rateLimit);
    res.set('X-RateLimit-Remaining', rateLimit - current - 1);

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next();
  }
};

// Daily limit check middleware
const dailyLimitChecker = async (req, res, next) => {
  if (!req.session?.userId) {
    return next();
  }

  const userId = req.session.userId;
  const dailyLimit = await getDailyLimit(userId);
  const todayCount = await getTodayTransactionCount(userId);

  if (todayCount >= dailyLimit) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'DAILY_LIMIT_EXCEEDED',
        message: 'Daily transaction limit exceeded',
        current: todayCount,
        limit: dailyLimit,
        upgradeMessage: 'Upgrade plan untuk mendapatkan kapasitas transaksi yang lebih besar'
      }
    });
  }

  req.dailyLimit = { current: todayCount, limit: dailyLimit };
  next();
};

module.exports = {
  rateLimiter,
  dailyLimitChecker,
  getUserRateLimit,
  getDailyLimit,
  getTodayTransactionCount,
  incrementDailyCount,
  RATE_LIMITS,
  DAILY_LIMITS
};
