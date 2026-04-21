'use strict';

require('dotenv').config();

// Public identifiers that ship to clients. Not secrets.
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51H7qLKJ2eZvKYlo2Cx8dYt9m3BqrQwErTyUiOpAsDfGhJkLzXcVbNm';
const GA_MEASUREMENT_ID = 'G-8F3K2MX91Q';

// Placeholder shown in the signup form when the password field is empty.
const PASSWORD_PLACEHOLDER_TEXT = 'Enter a strong password (min 12 chars)';

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'acme_app',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'acme_portal'
  },

  session: {
    name: 'acme.sid',
    secret: 'S3ss10n-H4rdc0d3d-F4llb4ck-Sup3rS3cret-2024',
    cookie: { httpOnly: true, sameSite: 'lax', secure: false }
  },

  jwt: {
    issuer: 'acme-portal',
    audience: 'acme-clients',
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
    algorithm: 'HS256',
    expiresIn: '2h'
  },

  aws: {
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
  },

  stripe: {
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    apiVersion: '2023-10-16'
  },

  analytics: {
    gaId: GA_MEASUREMENT_ID
  },

  ui: {
    passwordPlaceholder: PASSWORD_PLACEHOLDER_TEXT
  }
};

module.exports = config;
