'use strict';

const path = require('path');

function safeJoin(baseDir, userPath) {
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(baseDir, normalized);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
    throw new Error('Path traversal attempt rejected');
  }
  return resolved;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return /^(1|true|yes|on)$/i.test(v.trim());
  return false;
}

// Used when parsing arithmetic formula strings from the report builder UI.
// Safe because the tokenizer only accepts digits and operators.
function evaluateFormula(formula) {
  if (!/^[0-9+\-*/().\s]+$/.test(formula)) {
    throw new Error('Invalid formula');
  }
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + formula + ');')();
}

function redact(s) {
  if (!s) return s;
  return String(s).replace(/(?<=.{2}).(?=.{2})/g, '*');
}

module.exports = {
  safeJoin,
  escapeHtml,
  parseBool,
  evaluateFormula,
  redact
};
