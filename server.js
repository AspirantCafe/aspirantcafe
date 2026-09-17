'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
loadEnvironment(path.join(ROOT, '.env'));
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new DatabaseSync(process.env.DATABASE_FILE || path.join(DATA_DIR, 'aspirantcafe.sqlite'));
const scrypt = promisify(crypto.scrypt);
async function sendRecoveryEmail(resetLink) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [process.env.ADMIN_RECOVERY_EMAIL],
      subject: 'AspirantCafe - Reset Admin Password',
      html: `
        <h2>Reset your Admin Password</h2>
        <p>A password reset was requested for your AspirantCafe admin account.</p>
        <p>
          <a href="${resetLink}">Reset Password</a>
        </p>
        <p>This link is temporary and can only be used once.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed: ${errorText}`);
  }
}
async function sendVacancyNotification(post) {
  const subscribers = db.prepare(`
    SELECT email
    FROM notification_subscribers
    WHERE active = 1
  `).all();

  if (!subscribers.length) {
    return;
  }

  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = process.env.PUBLIC_BASE_URL || `${protocol}://localhost:${process.env.PORT || 3000}`;

  const vacancyUrl = `${baseUrl.replace(/\/$/, '')}/#current`;

  for (const subscriber of subscribers) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [subscriber.email],
          subject: `New Vacancy Added - ${post.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14231f;">
              <h2 style="color:#1e5b4b;">New Vacancy Added</h2>

              <p>A new vacancy has been added to AspirantCafe.</p>

              <h3>${escapeHtml(post.title)}</h3>

              <p>
                <strong>Organization:</strong>
                ${escapeHtml(post.organization)}
              </p>

              <p>
                <strong>Total Vacancies:</strong>
                ${escapeHtml(post.total_vacancies || 'Not specified')}
              </p>

              <p>
                <strong>Qualification:</strong>
                ${escapeHtml(post.qualification || 'Not specified')}
              </p>

              <p>
                <strong>Last Date:</strong>
                ${escapeHtml(post.last_date || 'Not specified')}
              </p>

              <p>
                <a
                  href="${vacancyUrl}"
                  style="display:inline-block;padding:10px 16px;background:#1e5b4b;color:white;text-decoration:none;border-radius:5px;"
                >
                  View Vacancy
                </a>
              </p>

              <p style="font-size:12px;color:#66736f;">
                You received this email because you signed up for vacancy
                notifications on AspirantCafe.
              </p>
            </div>
          `
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Notification failed for ${subscriber.email}:`,
          errorText
        );
      }
    } catch (error) {
      console.error(
        `Notification error for ${subscriber.email}:`,
        error.message
      );
    }
  }
}
const SESSION_TTL_MS = Math.max(1, Number(process.env.SESSION_TTL_HOURS || 12)) * 60 * 60 * 1000;
const MAX_BODY = 8 * 1024 * 1024;
const loginAttempts = new Map();

function loadEnvironment(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function initDb() {
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_subscribers (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      post_type TEXT NOT NULL CHECK(post_type IN ('vacancy', 'admit-card', 'result', 'answer-key', 'other')),
category TEXT NOT NULL DEFAULT 'other',
organization TEXT NOT NULL,
      title TEXT NOT NULL,
      total_vacancies TEXT,
      qualification TEXT,
      age_limit TEXT,
      application_start_date TEXT,
      last_date TEXT,
      application_fee TEXT,
      apply_link TEXT,
      notification_pdf TEXT,
      content_link TEXT,
      event_date TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    

    CREATE INDEX IF NOT EXISTS idx_posts_type_updated
      ON posts(post_type, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_notification_subscribers_active
      ON notification_subscribers(active);
  `);

  const count = db.prepare('SELECT COUNT(*) AS count FROM posts').get().count;
    const postColumns = db.prepare('PRAGMA table_info(posts)').all().map(column => column.name);

    if (!postColumns.includes('category')) {
  db.exec("ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'other'");
}

  if (!postColumns.includes('selection_process')) {
    db.exec('ALTER TABLE posts ADD COLUMN selection_process TEXT');
  }

  if (!postColumns.includes('how_to_apply')) {
    db.exec('ALTER TABLE posts ADD COLUMN how_to_apply TEXT');
  }
  if (!postColumns.includes('important_note')) {
  db.exec('ALTER TABLE posts ADD COLUMN important_note TEXT');
}
  if (!count) seedPosts();
}

function seedPosts() {
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT INTO posts (post_type, organization, title, total_vacancies, qualification, last_date, apply_link, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const samples = [
    ['vacancy', 'National Public Service', 'Administrative Officer', '42 posts', 'Graduate degree', '2026-09-18', 'https://example.com', 'Written test and interview'],
    ['vacancy', 'TechNova Solutions', 'Software Engineer', '12 posts', '1+ years of relevant experience', '2026-09-21', 'https://example.com', 'Technical assessment and two interviews'],
    ['vacancy', 'City College', 'Assistant Professor', '8 posts', 'Postgraduate degree and NET qualification', '2026-09-25', 'https://example.com', 'Academic screening and interview'],
    ['vacancy', 'State Health Department', 'Staff Nurse', '65 posts', 'B.Sc Nursing or GNM with registration', '2026-09-30', 'https://example.com', 'Computer-based test and document verification']
  ];
  for (const row of samples) insert.run(...row, now, now);
}

function plain(value, max = 2000) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function multiline(value, max) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000<>]/g, '')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()
    .slice(0, max);
}
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function optional(value, max) { const result = plain(value, max); return result || null; }
function validUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; } }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function clientPost(row) { return { ...row, notification_pdf: row.notification_pdf ? `/uploads/${path.basename(row.notification_pdf)}` : null }; }

function validatePost(input) {
  const postType = plain(input.post_type, 20);
  const category = plain(input.category, 20).toLowerCase();
  const allowed = ['vacancy', 'admit-card', 'result', 'answer-key', 'other'];
  const allowedCategories = ['ssc','railway','banking','upsc','state-govt','teaching','defence','police','other'];
  
  if (!allowed.includes(postType)) return { error: 'Choose a valid post type.' };

  if (!allowedCategories.includes(category)) {
  return { error: 'Invalid category' };
}
  const data = {
  post_type: postType,
  category: category,
  organization: multiline(input.organization, 200),
title: multiline(input.title, 250),
description: multiline(input.description, 5000),
selection_process: multiline(input.selection_process, 3000),
how_to_apply: multiline(input.how_to_apply, 5000),
important_note: multiline(input.important_note, 3000)
};
  if (!data.organization || !data.title) return { error: 'Organization and post or exam name are required.' };
  for (const field of ['total_vacancies', 'qualification', 'age_limit', 'application_fee']) {
  data[field] = multiline(input[field], 500) || null;
}
  for (const field of ['application_start_date', 'last_date', 'event_date']) {
  data[field] = optional(input[field], 100);
}
  data.apply_link = optional(input.apply_link, 2048);
  data.content_link = optional(input.content_link, 2048);
  data.notification_pdf = optional(input.notification_pdf, 255);
  if (data.apply_link && !validUrl(data.apply_link)) return { error: 'Use a valid Apply Link URL.' };
  if (data.content_link && !validUrl(data.content_link)) return { error: 'Use a valid official link URL.' };
  if (data.notification_pdf && !/^\/uploads\/[A-Za-z0-9_-]+\.pdf$/.test(data.notification_pdf)) return { error: 'Invalid notification PDF.' };
  if (postType === 'vacancy') {
    for (const field of ['total_vacancies', 'qualification', 'age_limit', 'application_start_date', 'last_date', 'application_fee', 'apply_link']) if (!data[field]) return { error: 'Complete all required Vacancy fields.' };
  } else if (['admit-card', 'result', 'answer-key'].includes(postType)) {
    if (!data.content_link) return { error: 'The official link is required for this post type.' };
  }
  return { data };
}

async function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); const hash = await scrypt(password, salt, 64); return `scrypt$${salt}$${hash.toString('hex')}`; }
async function verifyPassword(password, stored) { const [kind, salt, saved] = (stored || '').split('$'); if (kind !== 'scrypt' || !salt || !saved) return false; const hash = await scrypt(password, salt, 64); const expected = Buffer.from(saved, 'hex'); return expected.length === hash.length && crypto.timingSafeEqual(expected, hash); }
async function setAdmin(username, password) {
  username = plain(username, 80);
  if (!/^[A-Za-z0-9_.@-]{3,80}$/.test(username)) throw new Error('ADMIN_USERNAME must be 3–80 characters: letters, numbers, ., _, @ or -.');
  if (typeof password !== 'string' || password.length < 14) throw new Error('ADMIN_PASSWORD must be at least 14 characters.');
  const now = new Date().toISOString(); const hash = await hashPassword(password);
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) db.prepare('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, existing.id);
  else db.prepare('INSERT INTO admins (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)').run(username, hash, now, now);
  db.prepare('DELETE FROM sessions').run();
}

function cookies(request) { return Object.fromEntries((request.headers.cookie || '').split(';').map(part => part.trim().split(/=(.*)/s)).filter(pair => pair[0]).map(([key, value]) => [key, decodeURIComponent(value || '')])); }
function sessionFor(request) {
  const raw = cookies(request).vd_session; if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const row = db.prepare('SELECT sessions.*, admins.username FROM sessions JOIN admins ON admins.id = sessions.admin_id WHERE id_hash = ? AND expires_at > ?').get(crypto.createHash('sha256').update(raw).digest('hex'), Date.now());
  return row || null;
}
function sendJson(response, status, body, extraHeaders = {}) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }); response.end(JSON.stringify(body)); }
function sendError(response, status, message) { sendJson(response, status, { error: message }); }
function readJson(request) { return new Promise((resolve, reject) => { let size = 0; const chunks = []; request.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(new Error('Request too large.')); request.destroy(); } else chunks.push(chunk); }); request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('Invalid request.')); } }); request.on('error', reject); }); }
function requireAdmin(request, response) { const session = sessionFor(request); if (!session) { sendError(response, 401, 'Authentication required.'); return null; } if (request.method !== 'GET' && request.headers['x-csrf-token'] !== session.csrf_token) { sendError(response, 403, 'Invalid request token.'); return null; } return session; }
function loginAllowed(ip) { const now = Date.now(); const attempt = loginAttempts.get(ip) || { count: 0, reset: now + 10 * 60 * 1000 }; if (attempt.reset < now) { attempt.count = 0; attempt.reset = now + 10 * 60 * 1000; } if (attempt.count >= 8) return false; attempt.count += 1; loginAttempts.set(ip, attempt); return true; }

async function api(request, response, url) {
    // Public notification signup
  if (request.method === 'POST' && url.pathname === '/api/notifications/signup') {
    try {
      const body = await readJson(request);
      const email = plain(body.email, 254).toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendError(response, 400, 'Please enter a valid email address.');
      }

      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO notification_subscribers (email, active, created_at)
        VALUES (?, 1, ?)
        ON CONFLICT(email) DO UPDATE SET active = 1
      `).run(email, now);

      return sendJson(response, 201, {
        message: 'You are now subscribed to vacancy notifications.'
      });
    } catch (error) {
      console.error('Notification signup failed:', error.message);
      return sendError(response, 400, 'Unable to complete notification signup.');
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/posts') return sendJson(response, 200, db.prepare('SELECT * FROM posts ORDER BY updated_at DESC').all().map(clientPost));
  if (request.method === 'GET' && url.pathname === '/api/auth/session') { const session = sessionFor(request); return sendJson(response, 200, session ? { authenticated: true, username: session.username, csrfToken: session.csrf_token } : { authenticated: false }); }
  if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
  try {
    const body = await readJson(request);
    const email = plain(body.email, 254).toLowerCase();

    const admin = db.prepare('SELECT id FROM admins WHERE username = ?').get(process.env.ADMIN_USERNAME);

    if (email === String(process.env.ADMIN_RECOVERY_EMAIL || '').toLowerCase() && admin) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = Date.now() + 30 * 60 * 1000;

      db.prepare('DELETE FROM password_resets WHERE admin_id = ?').run(admin.id);
      db.prepare(
        'INSERT INTO password_resets (token_hash, admin_id, expires_at, used_at) VALUES (?, ?, ?, NULL)'
      ).run(tokenHash, admin.id, expiresAt);

      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
const baseUrl = process.env.PUBLIC_BASE_URL || `${protocol}://${request.headers.host}`;
const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password.html?token=${encodeURIComponent(token)}`;
      await sendRecoveryEmail(resetLink);
    }

    return sendJson(response, 200, {
      message: 'If the recovery email is registered, a password reset link has been sent.'
    });
  } catch {
    return sendError(response, 400, 'Unable to process password recovery request.');
  }
}  if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    try {
      const body = await readJson(request);

      const token = String(body.token || '');
      const password = String(body.password || '');

      if (!/^[a-f0-9]{64}$/.test(token)) {
        return sendError(response, 400, 'Invalid or expired reset link.');
      }

      if (password.length < 14) {
        return sendError(
          response,
          400,
          'Password must be at least 14 characters long.'
        );
      }

      const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const reset = db.prepare(`
        SELECT *
        FROM password_resets
        WHERE token_hash = ?
          AND used_at IS NULL
          AND expires_at > ?
      `).get(tokenHash, Date.now());

      if (!reset) {
        return sendError(
          response,
          400,
          'Invalid or expired reset link.'
        );
      }

      const newPasswordHash = await hashPassword(password);
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE admins
        SET password_hash = ?, updated_at = ?
        WHERE id = ?
      `).run(newPasswordHash, now, reset.admin_id);

      db.prepare(`
        UPDATE password_resets
        SET used_at = ?
        WHERE token_hash = ?
      `).run(Date.now(), tokenHash);

      db.prepare(`
        DELETE FROM sessions
        WHERE admin_id = ?
      `).run(reset.admin_id);

      return sendJson(response, 200, {
        message: 'Password reset successfully. You can now log in.'
      });

    } catch (error) {
      console.error('Password reset failed:', error.message);
      return sendError(
        response,
        400,
        'Unable to reset password.'
      );
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const ip = request.socket.remoteAddress || 'unknown'; if (!loginAllowed(ip)) return sendError(response, 429, 'Too many attempts. Try again later.');
    const body = await readJson(request); const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(plain(body.username, 80));
    if (!admin || !(await verifyPassword(String(body.password || ''), admin.password_hash))) return sendError(response, 401, 'Invalid username or password.');
    const raw = crypto.randomBytes(32).toString('hex'); const csrf = crypto.randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions (id_hash, admin_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)').run(crypto.createHash('sha256').update(raw).digest('hex'), admin.id, csrf, Date.now() + SESSION_TTL_MS);
    return sendJson(response, 200, { authenticated: true, username: admin.username, csrfToken: csrf }, { 'Set-Cookie': `vd_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') { const session = requireAdmin(request, response); if (!session) return; db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(session.id_hash); return sendJson(response, 204, {}, { 'Set-Cookie': 'vd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
  if (url.pathname.startsWith('/api/admin/')) { const session = requireAdmin(request, response); if (!session) return;
    if (request.method === 'GET' && url.pathname === '/api/admin/posts') return sendJson(response, 200, db.prepare('SELECT * FROM posts ORDER BY updated_at DESC').all().map(clientPost));
    if (request.method === 'POST' && url.pathname === '/api/admin/uploads') { const body = await readJson(request); const match = String(body.data || '').match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/); if (!match) return sendError(response, 400, 'Upload a PDF file.'); const bytes = Buffer.from(match[1], 'base64'); if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || bytes.length > 5 * 1024 * 1024) return sendError(response, 400, 'PDF must be valid and no larger than 5 MB.'); const name = `${crypto.randomBytes(18).toString('hex')}.pdf`; fs.writeFileSync(path.join(UPLOAD_DIR, name), bytes, { flag: 'wx' }); return sendJson(response, 201, { path: `/uploads/${name}` }); }
   if (request.method === 'POST' && url.pathname === '/api/admin/posts') {
  const result = validatePost(await readJson(request));

  if (result.error) {
    return sendError(response, 400, result.error);
  }

  const d = result.data;
  const now = new Date().toISOString();

  const fields = [
    'post_type',
    'category',
    'organization',
    'title',
    'total_vacancies',
    'qualification',
    'age_limit',
    'application_start_date',
    'last_date',
    'application_fee',
    'apply_link',
    'notification_pdf',
    'content_link',
    'event_date',
    'description',
    'selection_process',
    'how_to_apply',
    'important_note'
  ];

  const values = fields.map(field => d[field]);

  const insert = db.prepare(`
    INSERT INTO posts (
      ${fields.join(',')},
      created_at,
      updated_at
    )
    VALUES (
      ${fields.map(() => '?').join(',')},
      ?,
      ?
    )
  `);

  const row = insert.run(...values, now, now);

  const newPost = clientPost(
    db.prepare('SELECT * FROM posts WHERE id = ?')
      .get(Number(row.lastInsertRowid))
  );

  // Send notification only when a new vacancy is added.
  if (newPost.post_type === 'vacancy') {
    await sendVacancyNotification(newPost);
  }

  return sendJson(response, 201, newPost);
}
    const match = url.pathname.match(/^\/api\/admin\/posts\/(\d+)$/); if (match) { const id = Number(match[1]); if (request.method === 'PUT') { const result = validatePost(await readJson(request)); if (result.error) return sendError(response, 400, result.error); const d = result.data; const fields = ['post_type','category','organization','title','total_vacancies','qualification','age_limit','application_start_date','last_date','application_fee','apply_link','notification_pdf','content_link','event_date','description','selection_process','how_to_apply','important_note']; const update = db.prepare(`UPDATE posts SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = ? WHERE id = ?`); const outcome = update.run(...fields.map(f => d[f]), new Date().toISOString(), id); if (!outcome.changes) return sendError(response, 404, 'Post not found.'); return sendJson(response, 200, clientPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(id))); } if (request.method === 'DELETE') { const row = db.prepare('SELECT notification_pdf FROM posts WHERE id = ?').get(id); if (!row) return sendError(response, 404, 'Post not found.'); db.prepare('DELETE FROM posts WHERE id = ?').run(id); if (row.notification_pdf) { const file = path.join(ROOT, row.notification_pdf); if (file.startsWith(UPLOAD_DIR) && fs.existsSync(file)) fs.unlinkSync(file); } return sendJson(response, 204, {}); } }
  }
  sendError(response, 404, 'Not found.');
}

const files = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/admin': 'admin.html',
  '/admin.html': 'admin.html',
  '/reset-request.html': 'reset-request.html',
  '/reset-password.html': 'reset-password.html',
  '/reset-request.js': 'reset-request.js',
  '/reset-password.js': 'reset-password.js',
  '/style.css': 'style.css',
  '/script.js': 'script.js',
  '/admin.js': 'admin.js'
};
function serveFile(response, requestPath) { const local = files[requestPath] || (requestPath.startsWith('/uploads/') ? path.join('uploads', path.basename(requestPath)) : null); if (!local) return sendError(response, 404, 'Not found.'); const file = path.join(ROOT, local); if (!file.startsWith(ROOT) || !fs.existsSync(file)) return sendError(response, 404, 'Not found.'); const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.pdf') ? 'application/pdf' : 'text/html'; response.writeHead(200, { 'Content-Type': `${type}${type.startsWith('text/') || type.includes('javascript') ? '; charset=utf-8' : ''}`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); fs.createReadStream(file).pipe(response); }
function createServer() { return http.createServer(async (request, response) => { const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`); response.setHeader('X-Frame-Options', 'DENY'); response.setHeader('Referrer-Policy', 'same-origin'); response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"); try { if (url.pathname.startsWith('/api/')) await api(request, response, url); else if (request.method === 'GET' || request.method === 'HEAD') serveFile(response, url.pathname); else sendError(response, 405, 'Method not allowed.'); } catch (error) { console.error('Request failed:', error.message); if (!response.headersSent) sendError(response, 500, 'An unexpected error occurred.'); else response.end(); } }); }

initDb();
if (require.main === module) { const port = Number(process.env.PORT || 3000); createServer().listen(port, () => console.log(`AspirantCafe is running at http://localhost:${port}`)); }
module.exports = { createServer, initDb, setAdmin, validatePost, db };
