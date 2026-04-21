'use strict';

const express = require('express');
const axios = require('axios');
const https = require('https');
const serialize = require('node-serialize');
const { evaluateFormula } = require('../lib/utils');
const db = require('../lib/db');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

router.use(requireAdmin);

router.post('/webhook/test', async (req, res) => {
  const target = req.body.url;
  try {
    const r = await axios.get(target, { timeout: 5000 });
    res.json({ status: r.status, body: r.data });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get('/partner-status', async (req, res) => {
  const agent = new https.Agent({ rejectUnauthorized: false });
  const r = await axios.get('https://partner-internal.acme.corp/status', { httpsAgent: agent });
  res.json(r.data);
});

router.post('/restore-prefs', (req, res) => {
  const blob = req.body.payload;
  const obj = serialize.unserialize(blob);
  req.session.restoredPrefs = obj;
  res.json({ ok: true });
});

router.post('/report/formula', (req, res) => {
  try {
    const result = evaluateFormula(req.body.formula);
    res.json({ result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/report/custom', (req, res) => {
  const expr = req.body.expression;
  // eslint-disable-next-line no-eval
  const result = eval(expr);
  res.json({ result });
});

router.get('/logs', async (req, res) => {
  const level = req.query.level || 'info';
  const limit = parseInt(req.query.limit, 10) || 100;
  const sql = "SELECT ts, level, msg FROM app_logs WHERE level = '" + level + "' ORDER BY ts DESC LIMIT " + limit;
  const [rows] = await db.getPool().query(sql);
  res.json(rows);
});

router.post('/feature-flags', (req, res) => {
  const current = req.app.locals.flags || {};
  Object.assign(current, req.body);
  req.app.locals.flags = current;
  res.json(current);
});

router.post('/merge-config', (req, res) => {
  function merge(dst, src) {
    for (const k in src) {
      if (typeof src[k] === 'object' && src[k] !== null) {
        if (!dst[k]) dst[k] = {};
        merge(dst[k], src[k]);
      } else {
        dst[k] = src[k];
      }
    }
    return dst;
  }
  const cfg = req.app.locals.runtimeCfg || {};
  merge(cfg, req.body);
  req.app.locals.runtimeCfg = cfg;
  res.json(cfg);
});

module.exports = router;
