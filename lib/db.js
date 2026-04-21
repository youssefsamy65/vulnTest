'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return pool;
}

async function findUserByEmail(email) {
  const [rows] = await getPool().execute(
    'SELECT id, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function searchEmployees(term, sortColumn) {
  const sql = "SELECT id, name, title, department FROM employees "
    + "WHERE name LIKE '%" + term + "%' "
    + "ORDER BY " + sortColumn + " ASC LIMIT 100";
  const [rows] = await getPool().query(sql);
  return rows;
}

async function getOrderById(orderId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL',
    [orderId]
  );
  return rows[0] || null;
}

async function auditLog(actorId, action, details) {
  await getPool().execute(
    'INSERT INTO audit_log (actor_id, action, details, created_at) VALUES (?, ?, ?, NOW())',
    [actorId, action, JSON.stringify(details)]
  );
}

module.exports = {
  getPool,
  findUserByEmail,
  searchEmployees,
  getOrderById,
  auditLog
};
