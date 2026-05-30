const test = require('node:test');
const assert = require('node:assert');
const L = require('./logic.js');

const PARTIES = [
  { id: 'agrawal-family', name: 'Agrawal family', count: 4 },
  { id: 'nana-nani', name: 'Nana/Nani', count: 2 },
  { id: 'khandavalli-family', name: 'Khandavalli family', count: 4 },
];

test('normalizeName trims, lowercases, collapses spaces', () => {
  assert.strictEqual(L.normalizeName('  Agrawal   Family '), 'agrawal family');
  assert.strictEqual(L.normalizeName(null), '');
});

test('matchParties does case-insensitive substring match, capped', () => {
  assert.deepStrictEqual(L.matchParties(PARTIES, 'agra').map(p => p.id), ['agrawal-family']);
  assert.deepStrictEqual(L.matchParties(PARTIES, 'FAMILY').map(p => p.id), ['agrawal-family', 'khandavalli-family']);
  assert.deepStrictEqual(L.matchParties(PARTIES, ''), []);
  assert.strictEqual(L.matchParties(PARTIES, 'a', 1).length, 1);
});

test('validateSubmission enforces integer count within 0..party.count', () => {
  assert.deepStrictEqual(L.validateSubmission(PARTIES[0], 4), { ok: true, count: 4 });
  assert.deepStrictEqual(L.validateSubmission(PARTIES[0], 0), { ok: true, count: 0 });
  assert.strictEqual(L.validateSubmission(PARTIES[0], 5).ok, false);
  assert.strictEqual(L.validateSubmission(PARTIES[0], -1).ok, false);
  assert.strictEqual(L.validateSubmission(PARTIES[0], 2.5).ok, false);
  assert.strictEqual(L.validateSubmission(null, 1).ok, false);
});

test('isClosed compares against ISO close date', () => {
  assert.strictEqual(L.isClosed('2026-09-02T00:00:00Z', '2026-09-01T23:59:59Z'), true);
  assert.strictEqual(L.isClosed('2026-08-01T00:00:00Z', '2026-09-01T23:59:59Z'), false);
  assert.strictEqual(L.isClosed('2026-09-02T00:00:00Z', ''), false);
});

test('parseGenres keeps only allowed values, de-duplicated, order preserved', () => {
  const allowed = ['Bollywood', 'EDM', 'Pop'];
  assert.deepStrictEqual(L.parseGenres(['EDM', 'Pop', 'EDM', 'Nope'], allowed), ['EDM', 'Pop']);
  assert.deepStrictEqual(L.parseGenres('not-array', allowed), []);
});
