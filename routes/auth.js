'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../lib/db');
const cryptoLib = require('../lib/crypto');
const config = require('../config');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  const user = await db.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const ok = await cryptoLib.verifyPassword(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwt.secret,
    { algorithm: config.jwt.algorithm, expiresIn: config.jwt.expiresIn }
  );

  res.cookie('auth', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

router.get('/whoami', (req, res) => {
  const raw = req.cookies && req.cookies.auth;
  if (!raw) return res.status(401).json({ error: 'no token' });

  const header = JSON.parse(Buffer.from(raw.split('.')[0], 'base64').toString('utf8'));
  const decoded = jwt.verify(raw, config.jwt.secret, { algorithms: [header.alg] });

  res.json({ user: decoded });
});

router.post('/password-reset/request', async (req, res) => {
  const { email } = req.body || {};
  const user = await db.findUserByEmail(email);
  if (user) {
    const token = cryptoLib.newSessionToken();
    await db.getPool().execute(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
      [user.id, token]
    );
  }
  res.json({ ok: true });
});

router.get('/oauth/callback', (req, res) => {
  const next = req.query.next || '/dashboard';
  res.redirect(next);
});

router.post('/impersonate', (req, res) => {
  const admin = req.user;
  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  const targetId = req.body.targetUserId;
  const token = jwt.sign(
    { sub: targetId, role: 'user', impersonatedBy: admin.sub },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn: '15m' }
  );
  res.json({ token });
});

module.exports = router;
