# vulnTest — Scanner Evaluation Fixture

A realistic-looking internal portal ("acme-portal") seeded with a mix of
**true positives** (real vulnerabilities a scanner should flag) and
**false positives** (code that *looks* dangerous but is actually safe, to
catch naïve pattern-matchers).

The app is runnable:

```
npm install
node server.js
```

It will bind on port 3000 and register routes — DB calls will fail unless
you point `DB_*` env vars at a real MySQL, but all source-level detections
fire at static-analysis time.

---

## Scoring Key

- **TP** = True Positive — scanner **should** report this.
- **FP** = False Positive bait — scanner should **not** report this; if it
  does, it lacks the context to tell safe usage from unsafe.

---

## `config.js`

| Line context | Kind | Type | Notes |
|---|---|---|---|
| `STRIPE_PUBLISHABLE_KEY = 'pk_live_...'` | **FP** | Hardcoded secret | `pk_live_` is the **publishable** Stripe key — meant to ship to clients. A scanner that flags all `pk_live_` strings is wrong. |
| `GA_MEASUREMENT_ID = 'G-...'` | **FP** | Hardcoded secret | Public tracking ID. |
| `PASSWORD_PLACEHOLDER_TEXT` | **FP** | Hardcoded password | Variable name contains "password", value is UI helper text. |
| `session.secret = 'S3ss10n-H4rdc0d3d-F4llb4ck-...'` | **TP** | Hardcoded secret | Hardcoded session signing secret, no env fallback. |
| `jwt.secret = process.env.JWT_SECRET \|\| 'dev-jwt-secret-change-me'` | **TP** | Hardcoded secret | Weak hardcoded fallback used in production if env unset. |
| `aws.accessKeyId = 'AKIA...'` / `secretAccessKey = 'wJalrXUt...'` | **TP** | AWS credentials | Canonical AWS key shape, hardcoded. (The values are the AWS-documented *example* values — a scanner should still flag the pattern.) |
| `session.cookie.secure = false` | **TP** | Insecure cookie | Session cookie not marked Secure. |

---

## `lib/db.js`

| Function | Kind | Type | Notes |
|---|---|---|---|
| `findUserByEmail` | **FP** | SQL injection | Parameterised `?` placeholder — safe. |
| `searchEmployees` | **TP** | SQL injection | `term` and `sortColumn` concatenated directly into SQL. |
| `getOrderById` | **FP** | SQL injection | Parameterised. |
| `auditLog` | **FP** | SQL injection | Parameterised. |

---

## `lib/crypto.js`

| Function | Kind | Type | Notes |
|---|---|---|---|
| `hashPassword` / `verifyPassword` | **FP** | Weak hashing | bcrypt with cost 12 — correct. |
| `assetFingerprint` (MD5) | **FP** | Weak hash | MD5 used for CDN dedupe, non-security checksum. |
| `legacyPasswordHash` (SHA-1 + static salt) | **TP** | Weak password hashing | SHA-1 with a constant app-wide salt, used for passwords. |
| `encryptPII` / `decryptPII` | **FP** | Crypto misuse | AES-256-GCM, random 12-byte IV, auth tag — correct. |
| `encryptCardNumber` | **TP** | Crypto misuse | AES-CBC with a **static zero IV** on sensitive data. |
| `newSessionToken` | **TP** | Insecure randomness | Uses `Math.random()` for a security token. |
| `newCsrfToken` | **FP** | Insecure randomness | Uses `crypto.randomBytes` — correct. |

---

## `lib/utils.js`

| Function | Kind | Type | Notes |
|---|---|---|---|
| `safeJoin` | **FP** | Path traversal | Normalises, strips `..`, and verifies the resolved path is inside `baseDir`. |
| `escapeHtml` | **FP** | XSS | Proper HTML-entity escape. |
| `evaluateFormula` | **FP** | Code injection (`Function(...)`) | `new Function` used, but the input is gated by a strict `^[0-9+\-*/().\s]+$` allowlist — no identifiers reach the evaluator. |

---

## `routes/auth.js`

| Route / code | Kind | Type | Notes |
|---|---|---|---|
| `POST /login` | **FP** | SQL injection / auth | Uses parameterised lookup + bcrypt compare. |
| `GET /whoami` — `jwt.verify(raw, secret, { algorithms: [header.alg] })` | **TP** | JWT algorithm confusion | Trusts the algorithm declared in the token header; `alg: none` / HS/RS swap both work. |
| `POST /password-reset/request` | **TP** | Insecure randomness (indirect) | Token generated via `newSessionToken` (Math.random) — shared TP with crypto. |
| `GET /oauth/callback` — `res.redirect(next)` | **TP** | Open redirect | `next` query param used unfiltered. |
| `POST /impersonate` | **FP** | Auth bypass | Role-checks `req.user.role === 'admin'` before issuing token. |

---

## `routes/users.js`

| Route | Kind | Type | Notes |
|---|---|---|---|
| `GET /search` | **TP** | SQL injection | Calls `db.searchEmployees` with tainted `term` and `sort`. |
| `GET /:id/profile` — `<div class="bio">${emp.bio}</div>` | **TP** | Stored XSS | `bio` is rendered unescaped (comes from DB; employee-editable). |
| `POST /preferences` — `_.merge(prefs, req.body)` | **TP** | Prototype pollution | Classic lodash `_.merge` with unsanitised user object. |
| `GET /greet` | **FP** | Reflected XSS | Value escaped via `escapeHtml` before interpolation. |
| `POST /bulk-update` | **FP** | SQL injection | Parameterised `UPDATE`. |

---

## `routes/files.js`

| Route | Kind | Type | Notes |
|---|---|---|---|
| `GET /download` — `path.join(UPLOAD_DIR, file)` | **TP** | Path traversal | `file` from query is joined without containment check. |
| `GET /view` | **FP** | Path traversal | Uses `safeJoin` which enforces containment. |
| `POST /convert` — `exec('libreoffice ... ${format} ... ${input}')` | **TP** | Command injection | Shell-interpolates `format` (user-controlled) into `exec`. |
| `POST /thumbnail` — `execFile('convert', [...])` | **FP** | Command injection | `execFile` with argv array; width/height parsed as int. |
| `GET /backups/:name` | **FP** | Path traversal | `path.basename` strips any directory component. |
| `POST /fingerprint` | **FP** | Weak hash | MD5 of uploaded asset for CDN cache key. |
| `POST /restore` — `exec('tar ... ' + snapshot)` | **TP** | Command injection | String concatenation into `exec`. |
| `GET /template/:name` | **FP** | Path traversal | Whitelisted via object lookup. |

---

## `routes/admin.js`

| Route | Kind | Type | Notes |
|---|---|---|---|
| `POST /webhook/test` — `axios.get(req.body.url)` | **TP** | SSRF | Full user-controlled URL, no allowlist, no metadata-IP block. |
| `GET /partner-status` — `rejectUnauthorized: false` | **TP** | TLS verification disabled | Hardcoded insecure TLS agent. |
| `POST /restore-prefs` — `serialize.unserialize(blob)` | **TP** | Insecure deserialisation | `node-serialize` RCE sink on user input. |
| `POST /report/formula` | **FP** | Code injection | Delegates to `evaluateFormula` (allowlisted tokens only). |
| `POST /report/custom` — `eval(expr)` | **TP** | Code injection | Raw `eval` of request body. |
| `GET /logs` | **TP** | SQL injection | `level` and `limit` concatenated into SQL. |
| `POST /feature-flags` — `Object.assign(current, req.body)` | **FP** | Prototype pollution | `Object.assign` does not walk `__proto__` recursively — top-level assignment only. |
| `POST /merge-config` — custom recursive `merge` | **TP** | Prototype pollution | Home-rolled recursive merge with no `__proto__` / `constructor` guard. |

---

## `routes/reports.js`

| Route | Kind | Type | Notes |
|---|---|---|---|
| `GET /proxy` | **FP** | SSRF | Host allowlist + HTTPS-only check. |
| `GET /fetch` | **TP** | SSRF | Unrestricted `axios.get(req.query.src)`. |
| `GET /export/:id` — CSV | **TP** | CSV injection | `order.email` / `order.total` written into CSV without neutralising leading `=`, `+`, `-`, `@`. |
| `GET /validate-email` | **TP** | ReDoS | `/^([a-zA-Z0-9]+)+@.../` — nested quantifier, catastrophic backtracking. |
| `GET /slug-check` | **FP** | ReDoS | Anchored, non-overlapping alternation — linear. |

---

## `server.js`

| Line | Kind | Type | Notes |
|---|---|---|---|
| Error middleware sending `err.stack` to the client | **TP** | Information disclosure | Leaks stack traces to any caller. |
| JWT verified with `algorithms: ['HS256']` in the global middleware | **FP** | JWT misuse | Algorithm pinned; compare with the `/whoami` handler which is broken. |

---

## Summary of Expected Detections

Minimum true positives a competent scanner should report: **~26**

- SQL injection: 3 (`searchEmployees`, `/users/search`, `/admin/logs`)
- Command injection: 2 (`/files/convert`, `/files/restore`)
- Path traversal: 1 (`/files/download`)
- SSRF: 2 (`/admin/webhook/test`, `/reports/fetch`)
- XSS (stored): 1 (`/users/:id/profile`)
- Insecure deserialisation: 1 (`/admin/restore-prefs`)
- `eval` of request body: 1 (`/admin/report/custom`)
- Prototype pollution: 2 (`_.merge` in users, recursive merge in admin)
- Hardcoded secrets: 3 (session secret, JWT fallback, AWS keys)
- Weak crypto: 3 (SHA-1 pw hash, AES-CBC static IV, Math.random token)
- TLS verification disabled: 1
- JWT alg confusion: 1
- Open redirect: 1
- ReDoS: 1
- CSV injection: 1
- Verbose error / stack leak: 1
- Insecure cookie (`secure: false`): 1

Minimum false positives a mature scanner should **avoid**: **~18** (see FP
rows above). Any scanner flagging `pk_live_` publishable keys, MD5-for-ETag,
`escapeHtml`-wrapped interpolation, top-level `Object.assign`,
or `execFile` with an argv array is producing noise.
