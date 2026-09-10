require('dotenv').config();
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const passport = require('passport');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const path = require('path');

const { pool } = require('./config/database');
const configurePassport = require('./config/passport');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { csrfProtection } = require('./middleware/csrf');
const { securityHeaders } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 5000;

// Redis client
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// Security middleware
app.use(helmet());
app.use(securityHeaders);
app.use(hpp());
app.use(cors({
  origin: process.env.APP_URL,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session with Redis
const redisStore = new RedisStore({ client: redisClient, prefix: 'sess:' });
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'qris_session'
}));

// Passport
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// CSRF protection
app.use(csrfProtection);

// Static files
app.use(express.static(path.join(__dirname, '../frontend/build')));

// API routes
app.use('/api', routes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redisClient.ping();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Service unavailable' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
