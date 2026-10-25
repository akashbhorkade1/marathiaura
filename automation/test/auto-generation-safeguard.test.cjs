/* MarathiAura — Auto-Article-Generation Safeguard Tests
 * Verifies that AUTO_ARTICLE_GENERATION=false (default) prevents all
 * automatic article creation/modification under data/posts/.
 * Run: node automation/test/auto-generation-safeguard.test.cjs
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const POSTS_DIR = path.join(ROOT, 'data', 'posts');

function snapshotPosts() {
  const files = {};
  if (fs.existsSync(POSTS_DIR)) {
    for (const f of fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.json'))) {
      files[f] = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
    }
  }
  return files;
}

function countPosts() {
  if (!fs.existsSync(POSTS_DIR)) return 0;
  return fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.json')).length;
}

test('safeguard: autoArticleGenerationEnabled defaults to false', async () => {
  delete process.env.AUTO_ARTICLE_GENERATION;
  const lib = await import('../lib.mjs');
  assert.equal(lib.autoArticleGenerationEnabled(), false, 'default must be disabled');
});

test('safeguard: env var AUTO_ARTICLE_GENERATION=false disables generation', async () => {
  process.env.AUTO_ARTICLE_GENERATION = 'false';
  const lib = await import('../lib.mjs');
  assert.equal(lib.autoArticleGenerationEnabled(), false, 'env=false must disable');
});

test('safeguard: env var AUTO_ARTICLE_GENERATION=true enables generation', async () => {
  process.env.AUTO_ARTICLE_GENERATION = 'true';
  const lib = await import('../lib.mjs');
  assert.equal(lib.autoArticleGenerationEnabled(), true, 'env=true must enable');
  delete process.env.AUTO_ARTICLE_GENERATION;
});

test('safeguard: monitor.mjs exits without creating files when disabled', async () => {
  delete process.env.AUTO_ARTICLE_GENERATION;
  const before = snapshotPosts();
  const beforeCount = countPosts();

  const proc = require('child_process').spawnSync(
    process.execPath,
    [path.join(ROOT, 'automation', 'monitor.mjs')],
    { cwd: ROOT, encoding: 'utf8', timeout: 10000, env: { ...process.env, AUTO_ARTICLE_GENERATION: 'false' } }
  );

  const output = proc.stdout + proc.stderr;
  assert.ok(output.includes('AUTO_ARTICLE_GENERATION is disabled'), 'monitor should log disabled message: ' + output);
  assert.equal(proc.status, 0, 'monitor should exit 0 when disabled');

  const after = snapshotPosts();
  const afterCount = countPosts();
  assert.equal(afterCount, beforeCount, 'post count must not change');
  for (const [f, content] of Object.entries(before)) {
    assert.equal(after[f], content, `file ${f} must not be modified`);
  }
  for (const f of Object.keys(after)) {
    assert.ok(f in before, `no new file ${f} should appear`);
  }
});

test('safeguard: rewrite.mjs exits without modifying files when disabled', async () => {
  const before = snapshotPosts();

  const proc = require('child_process').spawnSync(
    process.execPath,
    [path.join(ROOT, 'automation', 'rewrite.mjs')],
    { cwd: ROOT, encoding: 'utf8', timeout: 10000, env: { ...process.env, AUTO_ARTICLE_GENERATION: 'false' } }
  );

  const output = proc.stdout + proc.stderr;
  assert.ok(output.includes('AUTO_ARTICLE_GENERATION is disabled'), 'rewrite should log disabled message: ' + output);
  assert.equal(proc.status, 0, 'rewrite should exit 0 when disabled');

  const after = snapshotPosts();
  for (const [f, content] of Object.entries(before)) {
    assert.equal(after[f], content, `file ${f} must not be modified by rewrite`);
  }
});

test('safeguard: ca-weekly.mjs exits without creating files when disabled', async () => {
  const before = snapshotPosts();
  const beforeCount = countPosts();

  const proc = require('child_process').spawnSync(
    process.execPath,
    [path.join(ROOT, 'automation', 'ca-weekly.mjs')],
    { cwd: ROOT, encoding: 'utf8', timeout: 10000, env: { ...process.env, AUTO_ARTICLE_GENERATION: 'false' } }
  );

  const output = proc.stdout + proc.stderr;
  assert.ok(output.includes('AUTO_ARTICLE_GENERATION is disabled'), 'ca-weekly should log disabled message: ' + output);
  assert.equal(proc.status, 0, 'ca-weekly should exit 0 when disabled');

  const after = snapshotPosts();
  const afterCount = countPosts();
  assert.equal(afterCount, beforeCount, 'post count must not change');
  for (const [f, content] of Object.entries(before)) {
    assert.equal(after[f], content, `file ${f} must not be modified`);
  }
  for (const f of Object.keys(after)) {
    assert.ok(f in before, `no new file ${f} should appear`);
  }
});

test('safeguard: ca-monthly.mjs exits without creating files when disabled', async () => {
  const before = snapshotPosts();
  const beforeCount = countPosts();

  const proc = require('child_process').spawnSync(
    process.execPath,
    [path.join(ROOT, 'automation', 'ca-monthly.mjs')],
    { cwd: ROOT, encoding: 'utf8', timeout: 10000, env: { ...process.env, AUTO_ARTICLE_GENERATION: 'false' } }
  );

  const output = proc.stdout + proc.stderr;
  assert.ok(output.includes('AUTO_ARTICLE_GENERATION is disabled'), 'ca-monthly should log disabled message: ' + output);
  assert.equal(proc.status, 0, 'ca-monthly should exit 0 when disabled');

  const after = snapshotPosts();
  const afterCount = countPosts();
  assert.equal(afterCount, beforeCount, 'post count must not change');
  for (const [f, content] of Object.entries(before)) {
    assert.equal(after[f], content, `file ${f} must not be modified`);
  }
  for (const f of Object.keys(after)) {
    assert.ok(f in before, `no new file ${f} should appear`);
  }
});

test('safeguard: existing published articles remain untouched', async () => {
  const before = snapshotPosts();
  assert.ok(Object.keys(before).length > 0, 'should have existing posts to verify');

  for (const script of ['monitor.mjs', 'rewrite.mjs', 'ca-weekly.mjs', 'ca-monthly.mjs']) {
    require('child_process').spawnSync(
      process.execPath,
      [path.join(ROOT, 'automation', script)],
      { cwd: ROOT, encoding: 'utf8', timeout: 10000, env: { ...process.env, AUTO_ARTICLE_GENERATION: 'false' } }
    );
  }

  const after = snapshotPosts();
  for (const [f, content] of Object.entries(before)) {
    assert.equal(after[f], content, `published article ${f} must remain unchanged`);
  }
  assert.equal(Object.keys(after).length, Object.keys(before).length, 'no posts added or removed');
});

test('safeguard: site.json has autoArticleGeneration explicitly set to false', async () => {
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
  assert.equal(site.site.autoArticleGeneration, false, 'site.json must explicitly set autoArticleGeneration: false');
});