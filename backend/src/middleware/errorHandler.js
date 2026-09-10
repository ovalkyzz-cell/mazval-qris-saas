const { pool } = require('../config/database');

const errorHandler = async (err, req, res, next) => {
  console.error('Error:', err);

  // Generate error ID for tracking
  const errorId = 'ERR-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  // Log error to database
  try {
    await pool.query(
      `INSERT INTO security_events (user_id, event_type, ip_address, user_agent, metadata, severity)
       VALUES ($1, 'SERVER_ERROR', $2, $3, $4, 'error')`,
      [
        req.user?.id || null,
        req.ip,
        req.headers['user-agent'],
        JSON.stringify({ errorId, message: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined })
      ]
    );
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }

  // Don't expose internal errors to client
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Terjadi kesalahan. Silakan coba lagi.' : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      errorId
    }
  });
};

class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { errorHandler, AppError };
