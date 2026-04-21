'use strict';

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const config = require('./config');
const auth = require('./routes/auth');
const users = require('./routes/users');
const files = require('./routes/files');
const admin = require('./routes/admin');
const reports = require('./routes/reports');

const app = express();

app.use(cookieParser());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  name: config.session.name,
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: config.session.cookie
}));

app.use((req, res, next) => {
  const raw = req.cookies && req.cookies.auth;
  if (!raw) return next();
  try {
    req.user = jwt.verify(raw, config.jwt.secret, { algorithms: ['HS256'] });
  } catch {
    // invalid token — treat as anonymous
  }
  next();
});

app.get('/healthz', (req, res) => res.json({ ok: true, env: config.env }));

app.use('/auth', auth);
app.use('/users', users);
app.use('/files', files);
app.use('/admin', admin);
app.use('/reports', reports);

app.use((err, req, res, next) => {
  // Debug error page shown to client to help the frontend team reproduce
  // issues in staging. Includes the raw stack trace.
  res.status(500).type('html').send(
    '<h1>Server error</h1><pre>' + err.stack + '</pre>'
  );
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`acme-portal listening on :${config.port}`);
  });
}

module.exports = app;
