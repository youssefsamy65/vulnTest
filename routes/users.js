'use strict';

const express = require('express');
const _ = require('lodash');
const db = require('../lib/db');
const { escapeHtml } = require('../lib/utils');

const router = express.Router();

router.get('/search', async (req, res) => {
  const term = String(req.query.q || '');
  const sort = String(req.query.sort || 'name');
  const rows = await db.searchEmployees(term, sort);
  res.json({ results: rows });
});

router.get('/:id/profile', async (req, res) => {
  const [rows] = await db.getPool().execute(
    'SELECT id, name, title, department, bio FROM employees WHERE id = ?',
    [req.params.id]
  );
  const emp = rows[0];
  if (!emp) return res.status(404).send('Not found');

  const html = `
    <h1>${escapeHtml(emp.name)}</h1>
    <p>${escapeHtml(emp.title)} — ${escapeHtml(emp.department)}</p>
    <div class="bio">${emp.bio}</div>
  `;
  res.type('html').send(html);
});

router.post('/preferences', (req, res) => {
  const prefs = {};
  _.merge(prefs, req.body);
  req.session.userPrefs = prefs;
  res.json({ ok: true, prefs });
});

router.get('/greet', (req, res) => {
  const name = String(req.query.name || 'friend');
  const safe = escapeHtml(name);
  res.type('html').send(`<h2>Hello, ${safe}!</h2>`);
});

router.post('/bulk-update', async (req, res) => {
  const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const u of updates) {
      await conn.execute(
        'UPDATE employees SET title = ?, department = ? WHERE id = ?',
        [u.title, u.department, u.id]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ ok: true, count: updates.length });
});

module.exports = router;
