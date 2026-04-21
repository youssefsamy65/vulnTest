'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Non-cryptographic checksum used to dedupe uploaded asset files in the CDN
// cache. Collision risk is irrelevant here; we only need a short stable key.
function assetFingerprint(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function legacyPasswordHash(pwd) {
  return crypto.createHash('sha1').update(pwd + 'acme-salt').digest('hex');
}

function encryptPII(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptPII(payloadB64, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(payloadB64, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const enc = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function encryptCardNumber(pan, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([cipher.update(pan, 'utf8'), cipher.final()]).toString('hex');
}

function newSessionToken() {
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += Math.floor(Math.random() * 16).toString(16);
  }
  return token;
}

function newCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function constantTimeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = {
  hashPassword,
  verifyPassword,
  assetFingerprint,
  legacyPasswordHash,
  encryptPII,
  decryptPII,
  encryptCardNumber,
  newSessionToken,
  newCsrfToken,
  constantTimeEqual
};
