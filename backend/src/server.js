require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const path = require('path');

const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { securityHeaders } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 5000;

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(hpp());
app.use(cors({ origin: true, credentials: true }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'mazval-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'none' },
  name: 'qris_session'
}));

// Routes
app.use('/api', routes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
