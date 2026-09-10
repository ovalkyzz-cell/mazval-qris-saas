// In-memory database for serverless deployment
// Data will reset on cold start - use external DB for production

const data = {
  users: [],
  roles: [
    { id: 1, name: 'ADMIN', description: 'System administrator', permissions: '["*"]' },
    { id: 2, name: 'RESELLER', description: 'Reseller account', permissions: '["manage_customers","view_transactions"]' },
    { id: 3, name: 'USER', description: 'Regular user', permissions: '["create_payment","view_history","manage_profile"]' }
  ],
  plans: [
    { id: 1, name: 'Free', slug: 'free', price: 0, daily_limit: 5, rate_limit: 5, features: '["QRIS Payment","Generate QR","Payment URL","Status Pembayaran"]', is_active: 1, display_order: 1, badge: null, marketing_text: 'Mulai gratis' },
    { id: 2, name: 'Basic', slug: 'basic', price: 10000, daily_limit: 100, rate_limit: 30, features: '["Semua fitur Free","API Access"]', is_active: 1, display_order: 2, badge: null, marketing_text: 'Cocok untuk pengguna serius' },
    { id: 3, name: 'Pro', slug: 'pro', price: 25000, daily_limit: 500, rate_limit: 120, features: '["Semua fitur Basic","Webhook","Advanced Analytics"]', is_active: 1, display_order: 3, badge: '🔥 MOST POPULAR', marketing_text: 'Cocok untuk bisnis berkembang' },
    { id: 4, name: 'Business', slug: 'business', price: 35000, daily_limit: 2000, rate_limit: 300, features: '["Semua fitur Pro","Reseller Ready","Custom Rate Limit"]', is_active: 1, display_order: 4, badge: '👑 BEST FOR BUSINESS', marketing_text: 'Cocok untuk traffic tinggi' },
    { id: 5, name: 'Reseller', slug: 'reseller', price: 35000, daily_limit: 2000, rate_limit: 300, features: '["Reseller Dashboard","Customer Management"]', is_active: 1, display_order: 5, badge: '🚀 FOR RESELLERS', marketing_text: 'Kelola multiple customer' }
  ],
  subscriptions: [],
  transactions: [],
  daily_usage: [],
  promo_codes: [],
  audit_logs: [],
  conversations: [],
  messages: [],
  resellers: []
};

let nextId = {
  users: 1,
  transactions: 1,
  subscriptions: 1,
  daily_usage: 1,
  promo_codes: 1,
  audit_logs: 1,
  conversations: 1,
  messages: 1,
  resellers: 1
};

// Create default admin
const bcrypt = require('bcryptjs');
const adminHash = bcrypt.hashSync('admin123', 10);
data.users.push({
  id: 1, email: 'admin@mazval.com', name: 'Admin', password_hash: adminHash,
  avatar: null, google_id: null, role_id: 1, status: 'active',
  last_login: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
});
data.subscriptions.push({
  id: 1, user_id: 1, plan_id: 3, status: 'active',
  started_at: new Date().toISOString(), expired_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
  custom_rate_limit: null
});
nextId.users = 2;
nextId.subscriptions = 2;

// Query helper
function query(sql, params = []) {
  // Simple SQL parser for basic operations
  const upperSql = sql.trim().toUpperCase();
  
  if (upperSql.startsWith('SELECT')) {
    return handleSelect(sql, params);
  } else if (upperSql.startsWith('INSERT')) {
    return handleInsert(sql, params);
  } else if (upperSql.startsWith('UPDATE')) {
    return handleUpdate(sql, params);
  } else if (upperSql.startsWith('DELETE')) {
    return handleDelete(sql, params);
  }
  
  return { rows: [], rowCount: 0 };
}

function handleSelect(sql, params) {
  // Extract table name
  const fromMatch = sql.match(/FROM\s+(\w+)/i);
  if (!fromMatch) return { rows: [], rowCount: 0 };
  
  const tableName = fromMatch[1].toLowerCase();
  let rows = [...(data[tableName] || [])];
  
  // Handle WHERE clauses
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)/is);
  if (whereMatch) {
    const conditions = whereMatch[1];
    rows = filterRows(rows, conditions, params);
  }
  
  // Handle ORDER BY
  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(?:ASC|DESC))?/i);
  if (orderMatch) {
    const field = orderMatch[1];
    rows.sort((a, b) => (a[field] > b[field] ? -1 : 1));
  }
  
  // Handle LIMIT and OFFSET
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
  if (limitMatch) {
    const limit = parseInt(limitMatch[1]);
    const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
    rows = rows.slice(offset, offset + limit);
  }
  
  // Handle COUNT(*)
  if (sql.includes('COUNT(*)')) {
    return { rows: [{ count: rows.length }], rowCount: 1 };
  }
  
  // Handle JOINs (simplified)
  if (sql.includes('JOIN')) {
    rows = handleJoins(rows, sql, tableName);
  }
  
  return { rows, rowCount: rows.length };
}

function filterRows(rows, conditions, params) {
  // Simple AND condition parsing
  const andParts = conditions.split(/\s+AND\s+/i);
  let paramIndex = 0;
  
  for (const part of andParts) {
    const trimmed = part.trim();
    
    if (trimmed.includes('=')) {
      const [field, value] = trimmed.split('=').map(s => s.trim());
      const cleanField = field.replace(/['"]/g, '');
      
      if (value === '?') {
        const param = params[paramIndex++];
        rows = rows.filter(r => r[cleanField] == param);
      } else if (value === 'datetime(\'now\')' || value === "datetime('now')") {
        // Skip date comparisons for now
      } else {
        const cleanValue = value.replace(/['"]/g, '');
        rows = rows.filter(r => String(r[cleanField]) === cleanValue);
      }
    } else if (trimmed.includes('LIKE')) {
      const [field, value] = trimmed.split('LIKE').map(s => s.trim());
      const cleanField = field.replace(/['"]/g, '');
      const param = params[paramIndex++];
      const pattern = String(param).replace(/%/g, '');
      rows = rows.filter(r => String(r[cleanField] || '').toLowerCase().includes(pattern.toLowerCase()));
    } else if (trimmed.includes('IS NULL')) {
      const field = trimmed.replace('IS NULL', '').trim();
      rows = rows.filter(r => r[field] === null || r[field] === undefined);
    } else if (trimmed.includes('>=')) {
      const [field, value] = trimmed.split('>=').map(s => s.trim());
      if (value === '?') {
        const param = params[paramIndex++];
        rows = rows.filter(r => new Date(r[field]) >= new Date(param));
      }
    } else if (trimmed.includes('<=')) {
      const [field, value] = trimmed.split('<=').map(s => s.trim());
      if (value === '?') {
        const param = params[paramIndex++];
        rows = rows.filter(r => new Date(r[field]) <= new Date(param));
      }
    }
  }
  
  return rows;
}

function handleJoins(rows, sql, mainTable) {
  if (sql.includes('JOIN roles')) {
    rows = rows.map(r => ({
      ...r,
      role_name: data.roles.find(role => role.id === r.role_id)?.name || null,
      permissions: data.roles.find(role => role.id === r.role_id)?.permissions || null
    }));
  }
  if (sql.includes('JOIN plans')) {
    rows = rows.map(r => ({
      ...r,
      plan_name: data.plans.find(p => p.id === r.plan_id)?.name || null,
      plan_slug: data.plans.find(p => p.id === r.plan_id)?.slug || null,
      price: data.plans.find(p => p.id === r.plan_id)?.price || 0,
      daily_limit: data.plans.find(p => p.id === r.plan_id)?.daily_limit || 5,
      rate_limit: data.plans.find(p => p.id === r.plan_id)?.rate_limit || 5
    }));
  }
  if (sql.includes('JOIN users')) {
    rows = rows.map(r => ({
      ...r,
      user_email: data.users.find(u => u.id === r.user_id)?.email || null,
      user_name: data.users.find(u => u.id === r.user_id)?.name || null
    }));
  }
  return rows;
}

function handleInsert(sql, params) {
  const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  if (!tableMatch) return { rows: [], rowCount: 0 };
  
  const tableName = tableMatch[1].toLowerCase();
  if (!data[tableName]) data[tableName] = [];
  
  const fieldsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
  if (!fieldsMatch) return { rows: [], rowCount: 0 };
  
  const fields = fieldsMatch[1].split(',').map(f => f.trim());
  const record = {};
  
  let paramIndex = 0;
  fields.forEach((field, i) => {
    const value = params[i];
    if (value === undefined || value === null) {
      record[field] = null;
    } else if (typeof value === 'string' && value.includes('datetime(')) {
      record[field] = new Date().toISOString();
    } else {
      record[field] = value;
    }
  });
  
  record.id = nextId[tableName]++;
  record.created_at = record.created_at || new Date().toISOString();
  record.updated_at = record.updated_at || new Date().toISOString();
  
  data[tableName].push(record);
  
  return { rows: [{ id: record.id }], rowCount: 1 };
}

function handleUpdate(sql, params) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch) return { rows: [], rowCount: 0 };
  
  const tableName = tableMatch[1].toLowerCase();
  const rows = data[tableName] || [];
  
  const whereMatch = sql.match(/WHERE\s+(.+?)$/is);
  let paramIndex = 0;
  
  // Parse SET clauses
  const setMatch = sql.match(/SET\s+(.+?)(?:WHERE|$)/is);
  if (!setMatch) return { rows: [], rowCount: 0 };
  
  const setClauses = setMatch[1].split(',').map(s => s.trim());
  
  // Find rows to update
  let updateParams = [...params];
  let whereParams = [];
  
  if (whereMatch) {
    const whereParts = whereMatch[1].split('=');
    whereParams = updateParams.splice(setClauses.length);
  }
  
  let updatedCount = 0;
  rows.forEach(row => {
    let shouldUpdate = true;
    
    // Check WHERE conditions
    if (whereMatch) {
      const whereStr = whereMatch[1];
      const whereAndParts = whereStr.split(/\s+AND\s+/i);
      let wIdx = 0;
      
      for (const part of whereAndParts) {
        if (part.includes('=')) {
          const [field] = part.split('=').map(s => s.trim());
          const cleanField = field.replace(/['"]/g, '');
          const value = params[setClauses.length + wIdx++];
          if (row[cleanField] != value) shouldUpdate = false;
        }
      }
    }
    
    if (shouldUpdate) {
      setClauses.forEach((clause, i) => {
        const [field] = clause.split('=').map(s => s.trim());
        let value = params[i];
        if (typeof value === 'string' && value.includes('datetime(')) {
          value = new Date().toISOString();
        }
        row[field] = value;
      });
      row.updated_at = new Date().toISOString();
      updatedCount++;
    }
  });
  
  return { rows: [], rowCount: updatedCount };
}

function handleDelete(sql, params) {
  const tableMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
  if (!tableMatch) return { rows: [], rowCount: 0 };
  
  const tableName = tableMatch[1].toLowerCase();
  const rows = data[tableName] || [];
  
  const whereMatch = sql.match(/WHERE\s+(.+?)$/is);
  if (!whereMatch) {
    const count = rows.length;
    data[tableName] = [];
    return { rows: [], rowCount: count };
  }
  
  let deletedCount = 0;
  const remaining = [];
  
  rows.forEach(row => {
    let shouldDelete = true;
    const whereParts = whereMatch[1].split(/\s+AND\s+/i);
    let paramIdx = 0;
    
    for (const part of whereParts) {
      if (part.includes('=')) {
        const [field] = part.split('=').map(s => s.trim());
        const cleanField = field.replace(/['"]/g, '');
        const value = params[paramIdx++];
        if (String(row[cleanField]) !== String(value)) shouldDelete = false;
      }
    }
    
    if (shouldDelete) {
      deletedCount++;
    } else {
      remaining.push(row);
    }
  });
  
  data[tableName] = remaining;
  return { rows: [], rowCount: deletedCount };
}

const pool = {
  query,
  connect: () => ({ query, release: () => {} }),
  end: () => {}
};

module.exports = { pool, query, data };
