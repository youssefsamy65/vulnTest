'use strict';

const express = require('express');
const axios = require('axios');
const url = require('url');
const db = require('../lib/db');

const router = express.Router();

const ALLOWED_REPORT_HOSTS = new Set([
  'reports.acme.corp',
  'bi.acme.corp',
  'metrics.acme.corp'
]);

router.get('/proxy', async (req, res) => {
  const target = String(req.query.target || '');
  let parsed;
  try {
    parsed = new url.URL(target);
  } catch {
    return res.status(400).json({ error: 'invalid url' });
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_REPORT_HOSTS.has(parsed.hostname)) {
    return res.status(400).json({ error: 'host not allowed' });
  }
  const r = await axios.get(parsed.toString(), { timeout: 10000 });
  res.json(r.data);
});

router.get('/fetch', async (req, res) => {
  const remote = req.query.src;
  const r = await axios.get(remote);
  res.type('text/plain').send(r.data);
});

router.get('/export/:id', async (req, res) => {
  const order = await db.getOrderById(req.params.id);
  if (!order) return res.status(404).send('not found');
  const csv = ['id,total,email', `${order.id},${order.total},${order.email}`].join('\n');
  res.type('text/csv').send(csv);
});

router.get('/validate-email', (req, res) => {
  const email = String(req.query.email || '');
  // Nested quantifier on the local-part lets a crafted string backtrack forever.
  const re = /^([a-zA-Z0-9]+)+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/;
  const ok = re.test(email);
  res.json({ ok });
});

router.get('/slug-check', (req, res) => {
  const slug = String(req.query.slug || '');
  const re = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  res.json({ ok: re.test(slug) });
});

module.exports = router;
