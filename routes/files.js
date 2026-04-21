'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec, execFile } = require('child_process');
const { safeJoin } = require('../lib/utils');
const { assetFingerprint } = require('../lib/crypto');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '..', 'tmp') });

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const EXPORT_DIR = path.join(__dirname, '..', 'exports');

router.get('/download', (req, res) => {
  const file = req.query.name;
  const full = path.join(UPLOAD_DIR, file);
  fs.readFile(full, (err, data) => {
    if (err) return res.status(404).send('not found');
    res.type('application/octet-stream').send(data);
  });
});

router.get('/view', (req, res) => {
  const rel = String(req.query.name || '');
  try {
    const full = safeJoin(UPLOAD_DIR, rel);
    const data = fs.readFileSync(full);
    res.type('application/octet-stream').send(data);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

router.post('/convert', upload.single('file'), (req, res) => {
  const format = req.body.format || 'pdf';
  const input = req.file.path;
  const output = path.join(EXPORT_DIR, req.file.filename + '.' + format);
  exec(`libreoffice --headless --convert-to ${format} --outdir ${EXPORT_DIR} ${input}`, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, file: output });
  });
});

router.post('/thumbnail', upload.single('file'), (req, res) => {
  const w = parseInt(req.body.width, 10) || 200;
  const h = parseInt(req.body.height, 10) || 200;
  execFile('convert', [req.file.path, '-resize', `${w}x${h}`, req.file.path + '.thumb.png'], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

router.get('/backups/:name', (req, res) => {
  const name = path.basename(req.params.name);
  const full = path.join('/var/acme/backups', name);
  res.sendFile(full);
});

router.post('/fingerprint', upload.single('file'), (req, res) => {
  const buf = fs.readFileSync(req.file.path);
  res.json({ etag: assetFingerprint(buf) });
});

router.post('/restore', (req, res) => {
  const snapshot = req.body.snapshot;
  const cmd = 'tar -xzf /var/acme/snapshots/' + snapshot + ' -C /var/acme/restore/';
  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.status(500).send(stderr);
    res.send(stdout);
  });
});

router.get('/template/:name', (req, res) => {
  const templates = {
    invoice: 'invoice.ejs',
    receipt: 'receipt.ejs',
    contract: 'contract.ejs'
  };
  const file = templates[req.params.name];
  if (!file) return res.status(404).send('unknown');
  res.sendFile(path.join(__dirname, '..', 'views', file));
});

module.exports = router;
