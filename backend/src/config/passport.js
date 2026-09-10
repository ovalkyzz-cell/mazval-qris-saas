const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('./database');

module.exports = function(passport) {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query(
        `SELECT u.*, r.name as role_name, r.permissions 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.id = $1 AND u.status = 'active'`,
        [id]
      );
      if (result.rows.length === 0) {
        return done(null, false);
      }
      done(null, result.rows[0]);
    } catch (error) {
      done(error, null);
    }
  });

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI,
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const googleId = profile.id;

      // Check if user exists
      let result = await pool.query(
        'SELECT * FROM users WHERE google_id = $1 OR email = $2',
        [googleId, email]
      );

      let user;

      if (result.rows.length > 0) {
        user = result.rows[0];
        // Update google_id if not set
        if (!user.google_id) {
          await pool.query(
            'UPDATE users SET google_id = $1, last_login = NOW() WHERE id = $2',
            [googleId, user.id]
          );
        }
        // Update last login
        await pool.query(
          'UPDATE users SET last_login = NOW(), last_ip = $1 WHERE id = $2',
          [null, user.id] // IP will be set in route handler
        );
      } else {
        // Create new user
        const roleResult = await pool.query(
          "SELECT id FROM roles WHERE name = 'USER'"
        );
        const roleId = roleResult.rows[0]?.id;

        result = await pool.query(
          `INSERT INTO users (email, name, avatar, google_id, role_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
           RETURNING *`,
          [email, profile.displayName, profile.photos?.[0]?.value, googleId, roleId]
        );
        user = result.rows[0];

        // Create free subscription
        const freePlan = await pool.query("SELECT id FROM plans WHERE slug = 'free'");
        if (freePlan.rows.length > 0) {
          await pool.query(
            `INSERT INTO subscriptions (user_id, plan_id, status, started_at, expired_at)
             VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '100 years')`,
            [user.id, freePlan.rows[0].id]
          );
        }
      }

      // Fetch full user with role
      result = await pool.query(
        `SELECT u.*, r.name as role_name, r.permissions 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.id = $1`,
        [user.id]
      );

      return done(null, result.rows[0]);
    } catch (error) {
      console.error('Passport error:', error);
      return done(error, null);
    }
  }));
};
