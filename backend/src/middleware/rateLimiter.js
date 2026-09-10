const { createClient } = require('redis');
const { pool } = require('../config/database');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

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

// Get user's effective rate limit
async function getUserRateLimit(userId) {
  try {
    // Check for custom rate limit in subscription
    const subResult = await pool.query(
      `SELECT s.custom_rate_limit, p.rate_limit, p.slug as plan_slug
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.status = 'active'`,
      [userId]
    );

    if (subResult.rows.length === 0) {
      return RATE_LIMITS.free;
    }

    const sub = subResult.rows[0];

    // Custom rate limit takes priority
    if (sub.custom_rate_limit) {
      return sub.custom_rate_limit;
    }

    // Plan rate limit
    return RATE_LIMITS[sub.plan_slug] || RATE_LIMITS.free;
  } catch (error) {
    console.error('Error getting rate limit:', error);
    return RATE_LIMITS.free;
  }
}

// Get user's daily transaction limit
async function getDailyLimit(userId) {
  try {
    const subResult = await pool.query(
      `SELECT p.daily_limit, p.slug as plan_slug
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.status = 'active'`,
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
    const result = await pool.query(
      `SELECT transaction_count FROM daily_usage 
       WHERE user_id = $1 AND date = $2`,
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
    await pool.query(
      `INSERT INTO daily_usage (user_id, date, transaction_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, date)
       DO UPDATE SET transaction_count = daily_usage.transaction_count + 1`,
      [userId, today]
    );
  } catch (error) {
    console.error('Error incrementing daily count:', error);
  }
}

// Rate limiting middleware
const rateLimiter = async (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const userId = req.user.id;
  const rateLimit = await getUserRateLimit(userId);
  const key = `ratelimit:${userId}`;
  const windowSeconds = 60; // 1 minute window

  try {
    // Get current count
    const current = await redisClient.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= rateLimit) {
      const ttl = await redisClient.ttl(key);
      res.set('Retry-After', ttl);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryAfter: ttl
        }
      });
    }

    // Increment count
    const multi = redisClient.multi();
    multi.incr(key);
    multi.expire(key, windowSeconds);
    await multi.exec();

    // Set rate limit headers
    res.set('X-RateLimit-Limit', rateLimit);
    res.set('X-RateLimit-Remaining', rateLimit - count - 1);
    res.set('X-RateLimit-Reset', new Date(Date.now() + windowSeconds * 1000).toISOString());

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(); // Allow request on error
  }
};

// Daily limit check middleware
const dailyLimitChecker = async (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const userId = req.user.id;
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
