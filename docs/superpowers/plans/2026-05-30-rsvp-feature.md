# RSVP Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the wedding site's RSVP section to a Google Sheet backend so guests find their party by name, pick how many of their allocated seats are coming (Day 1+2), and select music genres; the couple reads responses privately in the Sheet.

**Architecture:** Static custom HTML hosted free (Cloudflare Pages/Netlify) with `avtietheknot.com` DNS pointed at it. A Google Apps Script Web App bound to a dedicated, PII-free **RSVP Google Sheet** is the read/write API. The in-page React (Babel) RSVP component does a debounced server lookup and a POST submit. Pure request logic lives in one Node-tested module that is also pasted into Apps Script. A Python script consolidates the couple's private `Attendee List.xlsx` into the public `Parties` sheet.

**Tech Stack:** HTML + React 18 via Babel-standalone (existing), Google Apps Script, Google Sheets, Node `node:test` (logic unit tests), Python 3.14 + openpyxl (data prep), Playwright MCP (manual integration check).

---

## File Structure

- `rsvp/logic.js` — pure functions (name match, validation, close-date, genre filter). Node-tested; also pasted into Apps Script as `logic.gs`.
- `rsvp/logic.test.js` — `node:test` unit tests for `logic.js`.
- `rsvp/Code.gs` — Apps Script `doGet`/`doPost` + Sheet I/O. Uses `logic.js` functions.
- `rsvp/DEPLOY.md` — Google Sheet + Apps Script deployment + hosting/DNS steps.
- `scripts/build_parties_csv.py` — consolidate `Attendee List.xlsx` tabs → `rsvp/parties.csv`.
- `scripts/test_build_parties.py` — unittest for the pure consolidation function.
- `Wedding Website.html` — replace `PARTY_LIST` + `function RSVP()` with config + networked component (keep `RSVP_CONTACT`).

---

## Task 1: Pure RSVP logic module + unit tests

**Files:**
- Create: `rsvp/logic.js`
- Test: `rsvp/logic.test.js`

- [ ] **Step 1: Write the failing test**

Create `rsvp/logic.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test rsvp/`
Expected: FAIL — `Cannot find module './logic.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `rsvp/logic.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test rsvp/`
Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add rsvp/logic.js rsvp/logic.test.js
git commit -m "feat(rsvp): pure request logic module with node tests"
```

---

## Task 2: Consolidate guest list into a public Parties CSV

Converts the private `Attendee List.xlsx` (tabs `Bride Side`, `Groom Side`, `Karjat Groom Side`) into a clean, PII-free CSV: `Party ID,Party Name,Guest Count`. Drops header/total rows, blank names, and zero-count parties. De-dupes by normalized name (keeps the max count seen).

**Files:**
- Create: `scripts/build_parties_csv.py`
- Test: `scripts/test_build_parties.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/test_build_parties.py`:

```python
import unittest
from build_parties_csv import consolidate, slugify

class TestConsolidate(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify('Agrawal family'), 'agrawal-family')
        self.assertEqual(slugify('Shankar Rao & Padma Grandhi'), 'shankar-rao-padma-grandhi')

    def test_consolidate_filters_and_dedupes(self):
        # rows are dicts: {'name':..., 'count':...} already extracted per sheet
        rows = [
            {'name': 'Agrawal family', 'count': 4},
            {'name': 'Total Guest Count', 'count': 107},   # junk/total -> dropped by caller filter, but ensure name-based skip works
            {'name': '', 'count': 2},                       # blank -> dropped
            {'name': 'Nana/Nani', 'count': 0},              # zero -> dropped
            {'name': 'Khandavalli family', 'count': 4},
            {'name': 'Khandavalli family', 'count': 5},      # dup -> keep max (5)
        ]
        out = consolidate(rows, drop_names={'total guest count'})
        names = {r['name']: r['count'] for r in out}
        self.assertEqual(names, {'Agrawal family': 4, 'Khandavalli family': 5})
        # IDs are unique and slugified
        ids = [r['id'] for r in out]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn('agrawal-family', ids)

if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts && python -m unittest test_build_parties -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'build_parties_csv'`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/build_parties_csv.py`:

```python
"""Consolidate the private Attendee List.xlsx into a public Parties CSV.

Usage:
    python scripts/build_parties_csv.py "Attendee List.xlsx" rsvp/parties.csv \
        --sheets "Bride Side" "Groom Side"

Output columns: Party ID, Party Name, Guest Count
Only Day 1+2 parties. Choose the correct groom tab via --sheets.
"""
import argparse
import csv
import re
import sys

GUEST_COUNT_COL = 4   # column E (0-indexed) = "Guest Count"
NAME_COL = 0          # column A = "Name"

DROP_NAMES = {'name', 'total guest count', 'total room count'}


def slugify(name):
    s = name.strip().lower()
    s = re.sub(r'[&/]', ' ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return re.sub(r'-+', '-', s).strip('-')


def consolidate(rows, drop_names=DROP_NAMES):
    """rows: list of {'name': str, 'count': number}. Returns list of
    {'id','name','count'} filtered + deduped (max count), with unique slug ids."""
    best = {}
    order = []
    for r in rows:
        name = (r.get('name') or '').strip()
        if not name or name.lower() in drop_names:
            continue
        try:
            count = int(float(r.get('count') or 0))
        except (TypeError, ValueError):
            continue
        if count <= 0:
            continue
        key = re.sub(r'\s+', ' ', name.lower())
        if key not in best:
            best[key] = {'name': name, 'count': count}
            order.append(key)
        else:
            best[key]['count'] = max(best[key]['count'], count)
    out, used = [], set()
    for key in order:
        rec = best[key]
        base = slugify(rec['name']) or 'party'
        pid, n = base, 2
        while pid in used:
            pid, n = '%s-%d' % (base, n), n + 1
        used.add(pid)
        out.append({'id': pid, 'name': rec['name'], 'count': rec['count']})
    return out


def read_sheet(ws):
    rows = []
    for r in ws.iter_rows(values_only=True):
        name = r[NAME_COL] if len(r) > NAME_COL else None
        count = r[GUEST_COUNT_COL] if len(r) > GUEST_COUNT_COL else None
        rows.append({'name': name, 'count': count})
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx')
    ap.add_argument('out_csv')
    ap.add_argument('--sheets', nargs='+', default=['Bride Side', 'Groom Side'])
    args = ap.parse_args(argv)

    import openpyxl
    wb = openpyxl.load_workbook(args.xlsx, read_only=True, data_only=True)
    rows = []
    for sheet in args.sheets:
        if sheet not in wb.sheetnames:
            print('WARNING: sheet not found: %r' % sheet, file=sys.stderr)
            continue
        rows.extend(read_sheet(wb[sheet]))

    parties = consolidate(rows)
    with open(args.out_csv, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['Party ID', 'Party Name', 'Guest Count'])
        for p in parties:
            w.writerow([p['id'], p['name'], p['count']])
    print('Wrote %d parties to %s' % (len(parties), args.out_csv))


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts && python -m unittest test_build_parties -v`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Generate the real CSV and eyeball it**

Run: `python scripts/build_parties_csv.py "Attendee List.xlsx" rsvp/parties.csv --sheets "Bride Side" "Groom Side"`
Expected: prints `Wrote N parties to rsvp/parties.csv`; open the CSV and confirm party names + counts look right (no totals/blank rows). If the correct Day 1+2 groom tab is "Karjat Groom Side", re-run with that name instead — confirm with the couple.

- [ ] **Step 6: Commit**

```bash
git add scripts/build_parties_csv.py scripts/test_build_parties.py rsvp/parties.csv
git commit -m "feat(rsvp): script to build public parties CSV from attendee list"
```

---

## Task 3: Google Apps Script backend

Provides `doGet?action=lookup&q=` and `doPost` (submit). Reuses the Task 1 logic. Sheet I/O cannot be unit-tested locally, so logic stays in the tested module and this task is verified manually after deployment (Task 6).

**Files:**
- Create: `rsvp/Code.gs`

- [ ] **Step 1: Write the Apps Script**

Create `rsvp/Code.gs`:

```js
// === RSVP Apps Script ===
// Deploy: Extensions ▸ Apps Script in the RSVP Google Sheet. Create two files:
//   1) logic.gs  -> paste the ENTIRE contents of rsvp/logic.js
//   2) Code.gs   -> this file
// Then Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Who has access: Anyone.

var SHEET_ID = 'PASTE_RSVP_SHEET_ID';      // from the RSVP sheet URL
var PARTIES_TAB = 'Parties';
var RESPONSES_TAB = 'Responses';
var CLOSE_DATE = '';                        // ISO e.g. '2026-09-01T23:59:59-04:00'; '' = open
var ALLOWED_GENRES = [
  'Bollywood / Hindi', 'Punjabi & Bhangra', 'Telugu / Tollywood', 'Tamil & South',
  'Hip-Hop / R&B', 'EDM / House', 'Western Pop', 'Classic / Retro Bollywood',
  'Romantic & Slow', 'Garba / Dandiya'
]; // keep in sync with RSVP_CONFIG.genres in the website

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readParties() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(PARTIES_TAB);
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var id = values[i][0], name = values[i][1], count = values[i][2];
    if (id !== '' && name !== '') {
      out.push({ id: String(id), name: String(name), count: Number(count) || 0 });
    }
  }
  return out;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'lookup') {
    var q = (e.parameter.q) || '';
    var matches = matchParties(readParties(), q).map(function (p) {
      return { id: p.id, name: p.name, count: p.count };
    });
    return jsonOut({ status: 'ok', matches: matches });
  }
  return jsonOut({ status: 'error', error: 'unknown_action' });
}

function doPost(e) {
  var payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch (err) { return jsonOut({ status: 'error', error: 'bad_json' }); }

  if (isClosed(new Date().toISOString(), CLOSE_DATE)) {
    return jsonOut({ status: 'closed' });
  }

  var parties = readParties(), party = null;
  for (var i = 0; i < parties.length; i++) {
    if (parties[i].id === String(payload.partyId)) { party = parties[i]; break; }
  }
  var v = validateSubmission(party, payload.comingCount);
  if (!v.ok) return jsonOut({ status: 'error', error: v.error });

  var genres = parseGenres(payload.genres, ALLOWED_GENRES);
  upsertResponse(party.id, v.count, genres, String(payload.note || '').slice(0, 500));
  return jsonOut({ status: 'ok', count: v.count, party: party.name });
}

function upsertResponse(partyId, count, genres, note) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(RESPONSES_TAB);
  var values = sh.getDataRange().getValues();
  var row = [new Date(), partyId, count, genres.join(', '), note];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === String(partyId)) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}
```

- [ ] **Step 2: Commit**

```bash
git add rsvp/Code.gs
git commit -m "feat(rsvp): Apps Script web app (lookup + submit)"
```

(No automated test — pure logic is covered by Task 1; end-to-end verified in Task 6.)

---

## Task 4: Networked RSVP component in the website

Replace the hardcoded `PARTY_LIST` and client-only `function RSVP()` with a config block + a component that does a debounced server lookup and a POST submit, swapping the old names/diet fields for genre chips. Keep `RSVP_CONTACT` and all existing CSS classes.

**Files:**
- Modify: `Wedding Website.html` (the RSVP region — `const PARTY_LIST ...` through the end of `function RSVP() { ... }`, just before the `// ─── FAQ` comment is *above* it; RSVP is followed by the footer/app render — locate by searching `const PARTY_LIST` and the matching end of the `RSVP` function).

- [ ] **Step 1: Locate the exact region to replace**

Run: `grep -n "const PARTY_LIST" "Wedding Website.html"` and `grep -n "^function RSVP" "Wedding Website.html"` and find the first line after the RSVP function that begins a new top-level declaration (e.g. `function Footer`, `function App`, or a `// ───` banner). The region to replace starts at the `const PARTY_LIST = ...` line and ends at the closing `}` of `function RSVP()`.

- [ ] **Step 2: Replace the region**

Replace everything from `const PARTY_LIST = /*EDITME-PARTIES-BEGIN*/[ ... ]/*EDITME-PARTIES-END*/;` through the end of `function RSVP() { ... }` with:

```jsx
const RSVP_CONFIG = /*EDITME-RSVP-CONFIG-BEGIN*/{
  apiUrl: 'PASTE_APPS_SCRIPT_WEB_APP_URL',   // /exec URL from the Apps Script deployment
  closeDate: '',                              // ISO mirror of Apps Script CLOSE_DATE; '' = open
  genres: [
    'Bollywood / Hindi', 'Punjabi & Bhangra', 'Telugu / Tollywood', 'Tamil & South',
    'Hip-Hop / R&B', 'EDM / House', 'Western Pop', 'Classic / Retro Bollywood',
    'Romantic & Slow', 'Garba / Dandiya'
  ],
}/*EDITME-RSVP-CONFIG-END*/;

const RSVP_CONTACT = /*EDITME-CONTACT-BEGIN*/{
  email: 'anjanivarunwedding@gmail.com',
  contacts: [
    { name: 'Wedding Planner (TBD)', phone: 'TBD' },
  ],
}/*EDITME-CONTACT-END*/;

function RSVP() {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [looking, setLooking] = useState(false);
  const [party, setParty] = useState(null);
  const [attendance, setAttendance] = useState('all'); // 'all' | 'partial' | 'none'
  const [partial, setPartial] = useState(1);
  const [genres, setGenres] = useState([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const isClosed = !!RSVP_CONFIG.closeDate && Date.now() > new Date(RSVP_CONFIG.closeDate).getTime();

  // Debounced server lookup as the guest types.
  useEffect(() => {
    if (party || !search.trim()) { setMatches([]); setLooking(false); return; }
    setLooking(true);
    const handle = setTimeout(() => {
      const url = RSVP_CONFIG.apiUrl + '?action=lookup&q=' + encodeURIComponent(search.trim());
      fetch(url)
        .then(r => r.json())
        .then(d => { setMatches((d && d.matches) || []); })
        .catch(() => { setMatches([]); })
        .finally(() => setLooking(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search, party]);

  const select = (p) => { setParty(p); setPartial(p.count); setAttendance('all'); setSearch(''); setMatches([]); };
  const reset = () => { setParty(null); setAttendance('all'); setPartial(1); setGenres([]); setNote(''); setError(''); };
  const toggleGenre = (g) => setGenres(gs => gs.includes(g) ? gs.filter(x => x !== g) : [...gs, g]);

  const attendingCount = !party ? 0
    : attendance === 'all' ? party.count
    : attendance === 'partial' ? partial
    : 0;

  const submit = (e) => {
    e.preventDefault();
    if (!party || submitting || isClosed) return;
    setSubmitting(true); setError('');
    fetch(RSVP_CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight
      body: JSON.stringify({ partyId: party.id, comingCount: attendingCount, genres, note }),
    })
      .then(r => r.json())
      .then(d => {
        if (d && d.status === 'ok') setSubmitted(true);
        else if (d && d.status === 'closed') setError('RSVPs are now closed. Please reach out to us directly.');
        else setError('Something went wrong saving your RSVP. Please try again.');
      })
      .catch(() => setError('Could not reach the server. Please check your connection and try again.'))
      .finally(() => setSubmitting(false));
  };

  return (
    <section id="rsvp">
      <div className="wc-blob" style={{width:500,height:500,top:'-100px',left:'-100px',background:'var(--gold)',opacity:0.07}}/>
      <div className="section-inner">
        <div style={{display:'flex',gap:'4rem',flexWrap:'wrap'}}>
          <div style={{flex:'1',minWidth:280}}>
            <div className="section-eyebrow">You're Invited</div>
            <div className="section-title">RSVP</div>
            <div className="section-subtitle">
              Please find your name below and let us know if you can make it. All guests are RSVP'd for both the Dec 11 &amp; Dec 12 celebrations.
            </div>
            <div style={{marginTop:'2rem',fontFamily:'Cormorant Garamond, serif',fontSize:'1.6rem',color:'var(--gold)',lineHeight:1.4}}>
              "The joy of celebrating<br/><em>with the people you love</em><br/>is the greatest gift of all."
            </div>
          </div>
          <div style={{flex:'1.2',minWidth:300}}>
            {isClosed ? (
              <div className="rsvp-success" style={{padding:'2.5rem 1.5rem'}}>
                <div className="big-check">💌</div>
                <div style={{fontFamily:'Cormorant Garamond, serif',fontSize:'2.1rem',color:'var(--primary-deep)'}}>RSVPs are closed</div>
                <div style={{color:'var(--text2)',marginTop:'0.75rem',fontSize:'0.95rem',lineHeight:1.7,maxWidth:420,margin:'0.75rem auto 0'}}>
                  Our RSVP window has closed. If you still need to reach us, please use the contact details below.
                </div>
              </div>
            ) : submitted ? (
              <div className="rsvp-success" style={{padding:'2.5rem 1.5rem'}}>
                <div className="big-check">{attendingCount > 0 ? '🎉' : '💌'}</div>
                <div style={{fontFamily:'Cormorant Garamond, serif',fontSize:'2.1rem',color:'var(--primary-deep)'}}>{attendingCount > 0 ? 'See you there!' : "You'll be missed."}</div>
                <div style={{color:'var(--text2)',marginTop:'0.75rem',fontSize:'0.95rem',lineHeight:1.7,maxWidth:420,margin:'0.75rem auto 0'}}>
                  {attendingCount > 0 ? (
                    <>We've recorded <strong>{attendingCount}</strong> {attendingCount===1?'guest':'guests'} from <strong>{party.name}</strong> for both the Dec 11 &amp; Dec 12 celebrations. We can't wait to celebrate with you!</>
                  ) : (
                    <>Thank you for letting us know, <strong>{party.name}</strong>. We'll miss you, but we deeply appreciate your blessings from afar.</>
                  )}
                </div>
                <button onClick={()=>{setSubmitted(false); reset();}} style={{marginTop:'1.75rem',padding:'0.6rem 1.6rem',borderRadius:24,border:'1px solid var(--border)',background:'transparent',cursor:'pointer',color:'var(--text2)',fontSize:'0.85rem',fontFamily:"'DM Sans',sans-serif"}}>Submit another RSVP</button>
              </div>
            ) : (
              <form className="rsvp-form" onSubmit={submit}>
                {!party ? (
                  <>
                    <div className="form-group">
                      <label>Step 1 — Find your name</label>
                      <input
                        value={search}
                        onChange={e=>setSearch(e.target.value)}
                        placeholder="Type your name or family name..."
                      />
                    </div>
                    {looking && <div style={{padding:'0.5rem 0.25rem',fontSize:'0.8rem',color:'var(--text2)'}}>Searching…</div>}
                    {matches.length > 0 && (
                      <div style={{border:'1px solid var(--border)',borderRadius:8,background:'var(--bg2)',marginTop:'-0.5rem',marginBottom:'1rem',maxHeight:280,overflowY:'auto'}}>
                        {matches.map(p => (
                          <button
                            key={p.id} type="button" onClick={()=>select(p)}
                            style={{display:'flex',width:'100%',justifyContent:'space-between',alignItems:'center',padding:'0.8rem 1rem',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',color:'var(--text)'}}>
                            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem'}}>{p.name}</span>
                            <span style={{fontSize:'0.72rem',color:'var(--gold)',letterSpacing:'0.05em'}}>{p.count} {p.count===1?'seat':'seats'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!looking && search.trim() && matches.length === 0 && (
                      <div style={{padding:'0.85rem 1rem',background:'var(--bg2)',borderRadius:8,fontSize:'0.85rem',color:'var(--text2)',marginBottom:'1rem',lineHeight:1.6}}>
                        No matches yet — try just your last name, or scroll down to contact us if you can't find your party.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{padding:'1.25rem 1.5rem',background:'linear-gradient(135deg,var(--bg2),var(--bg))',border:'1px solid var(--border)',borderRadius:12,marginBottom:'1.5rem'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem',flexWrap:'wrap'}}>
                        <div>
                          <div style={{fontSize:'0.7rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--gold)'}}>Hello</div>
                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--primary-deep)',marginTop:'0.2rem',lineHeight:1.2}}>{party.name}</div>
                          <div style={{fontSize:'0.85rem',color:'var(--text2)',marginTop:'0.5rem',lineHeight:1.6}}>
                            We've reserved <strong style={{color:'var(--primary-deep)'}}>{party.count} {party.count===1?'seat':'seats'}</strong> for you across both Dec 11 &amp; Dec 12.
                          </div>
                        </div>
                        <button type="button" onClick={reset} style={{background:'none',border:'none',color:'var(--gold)',cursor:'pointer',fontSize:'0.78rem',whiteSpace:'nowrap'}}>← not you?</button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Step 2 — Will you be joining us?</label>
                      <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                        {[
                          {k:'all',    t:`Yes — all ${party.count} of us`},
                          {k:'partial',t:'Yes — some of us'},
                          {k:'none',   t:"Sorry, we can't make it"},
                        ].map(opt => (
                          <button key={opt.k} type="button" onClick={()=>setAttendance(opt.k)}
                            style={{textAlign:'left',padding:'0.7rem 1rem',borderRadius:8,cursor:'pointer',
                              border:'1px solid ' + (attendance===opt.k?'var(--gold)':'var(--border)'),
                              background: attendance===opt.k?'var(--bg2)':'transparent',
                              color:'var(--text)',fontSize:'0.9rem',fontFamily:"'DM Sans',sans-serif"}}>
                            {attendance===opt.k ? '● ' : '○ '}{opt.t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {attendance==='partial' && (
                      <div className="form-group">
                        <label>How many will attend?</label>
                        <select value={partial} onChange={e=>setPartial(Number(e.target.value))}>
                          {Array.from({length: party.count}, (_,i)=>i+1).map(n => (
                            <option key={n} value={n}>{n} {n===1?'guest':'guests'}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {attendance!=='none' && (
                      <div className="form-group">
                        <label>Step 3 — What music gets your party dancing? (pick any)</label>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
                          {RSVP_CONFIG.genres.map(g => (
                            <button key={g} type="button" onClick={()=>toggleGenre(g)}
                              style={{padding:'0.45rem 0.9rem',borderRadius:20,cursor:'pointer',fontSize:'0.82rem',
                                border:'1px solid ' + (genres.includes(g)?'var(--gold)':'var(--border)'),
                                background: genres.includes(g)?'var(--gold)':'transparent',
                                color: genres.includes(g)?'#fff':'var(--text2)',fontFamily:"'DM Sans',sans-serif"}}>
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Anything else? (optional)</label>
                      <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
                        placeholder="Song requests, dietary needs, a note for us..." />
                    </div>

                    {error && (
                      <div style={{padding:'0.75rem 1rem',background:'rgba(200,60,60,0.08)',border:'1px solid rgba(200,60,60,0.3)',borderRadius:8,color:'#a33',fontSize:'0.85rem',marginBottom:'1rem'}}>{error}</div>
                    )}

                    <button type="submit" disabled={submitting} className="rsvp-submit"
                      style={{opacity:submitting?0.6:1,cursor:submitting?'wait':'pointer'}}>
                      {submitting ? 'Sending…' : 'Send RSVP'}
                    </button>
                  </>
                )}
              </form>
            )}
            <div style={{marginTop:'1.75rem',fontSize:'0.82rem',color:'var(--text2)',lineHeight:1.7,textAlign:'center'}}>
              Can't find your party or need help? Email <a href={'mailto:'+RSVP_CONTACT.email} style={{color:'var(--gold)'}}>{RSVP_CONTACT.email}</a>
              {RSVP_CONTACT.contacts.map((c,i)=>(<span key={i}><br/>{c.name}: {c.phone}</span>))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Note: this reuses existing classes (`rsvp-form`, `form-group`, `rsvp-success`, `big-check`, `section-eyebrow`, `section-title`, `section-subtitle`, `wc-blob`). It adds a `rsvp-submit` button class and a `<textarea>` — if `.rsvp-submit` styling is absent, the inline style still renders a usable button; verify visually in Step 4.

- [ ] **Step 3: Confirm there are no leftover references to `PARTY_LIST`**

Run: `grep -n "PARTY_LIST" "Wedding Website.html"`
Expected: no results. If any remain, remove them.

- [ ] **Step 4: Verify it renders (with a temporary mock endpoint)**

Temporarily set `RSVP_CONFIG.apiUrl` to a mock so the UI can be exercised before the real Apps Script exists. In the running site (`python -m http.server 8000`), load `http://localhost:8000/Wedding%20Website.html#rsvp`. Because no real API is wired yet, confirm only the static render + step transitions: the search box appears; typing shows "Searching…"; the "no matches" copy appears (lookup will fail to a real server — that's expected pre-deploy). Full lookup/submit is verified in Task 6 after deployment.

Expected: RSVP section renders without console errors from the component itself (network error for the placeholder URL is acceptable).

- [ ] **Step 5: Commit**

```bash
git add "Wedding Website.html"
git commit -m "feat(rsvp): networked RSVP component (lookup + submit + genres)"
```

---

## Task 5: Deployment + hosting documentation

**Files:**
- Create: `rsvp/DEPLOY.md`

- [ ] **Step 1: Write the deployment guide**

Create `rsvp/DEPLOY.md`:

```markdown
# RSVP Deployment

## 1. RSVP Google Sheet (public-safe, no PII)
1. Create a new Google Sheet named "AV Wedding RSVP".
2. Tab **Parties** with header row: `Party ID | Party Name | Guest Count`.
   Import `rsvp/parties.csv` (File ▸ Import ▸ Upload ▸ Replace current sheet).
3. Tab **Responses** with header row: `Timestamp | Party ID | Coming Count | Genres | Note`.
4. Copy the Sheet ID from its URL (`/d/<SHEET_ID>/edit`).

## 2. Apps Script API
1. In the sheet: Extensions ▸ Apps Script.
2. Create file `logic.gs` → paste the entire contents of `rsvp/logic.js`.
3. Replace `Code.gs` contents with `rsvp/Code.gs`.
4. Set `SHEET_ID`, optionally `CLOSE_DATE` (ISO), and confirm `ALLOWED_GENRES`
   matches the website's `RSVP_CONFIG.genres`.
5. Deploy ▸ New deployment ▸ Type: Web app ▸ Execute as: **Me** ▸
   Who has access: **Anyone** ▸ Deploy. Authorize when prompted.
6. Copy the Web app URL (ends in `/exec`).

## 3. Wire the website
1. In `Wedding Website.html`, set `RSVP_CONFIG.apiUrl` to the `/exec` URL.
2. Set `RSVP_CONFIG.closeDate` to the same value as `CLOSE_DATE` (or leave `''`).

## 4. Host the site + domain
1. Push the repo to GitHub.
2. Cloudflare Pages (or Netlify): create a project from the repo, framework
   preset **None**, build command **(none)**, output directory **/** (root).
3. After deploy, add custom domain `avtietheknot.com`.
4. In the Squarespace domain DNS settings, point the domain at the host
   (Cloudflare/Netlify) per their custom-domain instructions (CNAME/A records).
   Squarespace remains only the registrar.

## 5. Keeping it private
- The RSVP sheet holds NO phone/email/notes — only party names + counts.
- Keep `Attendee List.xlsx` and any private planning sheet OUT of the repo's
  deployed output / out of the public sheet.
```

- [ ] **Step 2: Commit**

```bash
git add rsvp/DEPLOY.md
git commit -m "docs(rsvp): deployment and hosting guide"
```

---

## Task 6: End-to-end verification (post-deploy)

Run after the couple has created the sheet and deployed the Apps Script (Tasks 3 & 5). No code; this confirms the live flow.

- [ ] **Step 1: Set real config**

Confirm `RSVP_CONFIG.apiUrl` (website) and `SHEET_ID` (Apps Script) point at the real deployment. Run the local server: `python -m http.server 8000`.

- [ ] **Step 2: Lookup works**

In the browser, open `http://localhost:8000/Wedding%20Website.html#rsvp`, type a known party name. Expected: matching parties appear with correct seat counts; selecting one shows the reserved-seats card.

- [ ] **Step 3: Submit + overwrite works**

Choose "Yes — all", pick 2 genres, submit. Expected: success screen. In the sheet's **Responses** tab, a row appears with the party ID, count, and genres. Submit again for the same party with different values. Expected: the SAME row updates (no duplicate).

- [ ] **Step 4: Bounds + closed**

Temporarily set `CLOSE_DATE` to a past date and redeploy; submit. Expected: the form shows the "RSVPs are now closed" error and no row is written. Reset `CLOSE_DATE` afterward.

- [ ] **Step 5: Couple vibe view**

In the **Responses** tab, create a Filter view; confirm filtering by a genre and sorting by Coming Count works for planning. Document the view for the couple.

- [ ] **Step 6: Commit any config changes**

```bash
git add "Wedding Website.html" rsvp/Code.gs
git commit -m "chore(rsvp): wire real deployment config"
```
```
