'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'aspirantcafe-test-'));
process.env.DATABASE_FILE = path.join(temporary, 'test.sqlite');
const { createServer, setAdmin, db } = require('../server');
let server, base, cookie, csrf;

test.before(async () => {
  await setAdmin('test-admin', 'a-long-test-password');
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test-admin', password: 'a-long-test-password' }) });
  assert.equal(login.status, 200); csrf = (await login.json()).csrfToken; cookie = login.headers.get('set-cookie').split(';')[0];
});
test.after(() => { server.close(); db.close(); fs.rmSync(temporary, { recursive: true, force: true }); });
const call = (url, options = {}) => fetch(`${base}${url}`, { ...options, headers: { Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json', ...(options.headers || {}) } });

test('admin endpoints reject anonymous writes', async () => {
  const response = await fetch(`${base}/api/admin/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 401);
});
test('admit card does not require vacancy fields', async () => {
  const response = await call('/api/admin/posts', { method: 'POST', body: JSON.stringify({ post_type: 'admit-card', organization: 'Exam Board', title: 'Clerk Exam', content_link: 'https://example.com/admit-card' }) });
  assert.equal(response.status, 201); const post = await response.json(); assert.equal(post.post_type, 'admit-card');
  assert.equal((await call(`/api/admin/posts/${post.id}`, { method: 'DELETE' })).status, 204);
});
test('result does not require vacancy fields', async () => {
  const response = await call('/api/admin/posts', { method: 'POST', body: JSON.stringify({ post_type: 'result', organization: 'Exam Board', title: 'Clerk Result', content_link: 'https://example.com/result' }) });
  assert.equal(response.status, 201); const post = await response.json();
  assert.equal((await call(`/api/admin/posts/${post.id}`, { method: 'PUT', body: JSON.stringify({ post_type: 'result', organization: 'Exam Board', title: 'Updated Clerk Result', content_link: 'https://example.com/result' }) })).status, 200);
  assert.equal((await call(`/api/admin/posts/${post.id}`, { method: 'DELETE' })).status, 204);
});
test('vacancy validation requires its relevant fields', async () => {
  const response = await call('/api/admin/posts', { method: 'POST', body: JSON.stringify({ post_type: 'vacancy', organization: 'Board', title: 'Missing fields' }) });
  assert.equal(response.status, 400);
});
