// Pure, dependency-free RSVP logic. Node-tested (rsvp/logic.test.js) and ALSO
// pasted into Apps Script as `logic.gs` (the module.exports guard is harmless there).

function normalizeName(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchParties(parties, query, limit) {
  limit = limit || 8;
  var q = normalizeName(query);
  if (!q) return [];
  var out = [];
  for (var i = 0; i < parties.length && out.length < limit; i++) {
    if (normalizeName(parties[i].name).indexOf(q) !== -1) out.push(parties[i]);
  }
  return out;
}

function isClosed(nowISO, closeISO) {
  if (!closeISO) return false;
  return new Date(nowISO).getTime() > new Date(closeISO).getTime();
}

function validateSubmission(party, comingCount) {
  if (!party) return { ok: false, error: 'unknown_party' };
  var n = Number(comingCount);
  if (!Number.isInteger(n) || n < 0 || n > Number(party.count)) {
    return { ok: false, error: 'bad_count' };
  }
  return { ok: true, count: n };
}

function parseGenres(genres, allowed) {
  if (!Array.isArray(genres)) return [];
  var allow = {};
  for (var i = 0; i < allowed.length; i++) allow[allowed[i]] = true;
  var seen = {}, out = [];
  for (var j = 0; j < genres.length; j++) {
    var g = genres[j];
    if (allow[g] && !seen[g]) { seen[g] = true; out.push(g); }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeName, matchParties, isClosed, validateSubmission, parseGenres };
}
