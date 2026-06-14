// === RSVP Apps Script — Anjani & Varun ===
// CONTAINER-BOUND to the "Attendee List" spreadsheet. Reads/writes ONLY the
// website-facing tab below — never the private "Bride Side" / "Groom Side" tabs,
// so phone numbers are never exposed through the API.
//
// Deploy (from the sheet):
//   1) Extensions ▸ Apps Script.
//   2) Create a file `logic.gs` and paste the ENTIRE contents of rsvp/logic.js.
//   3) Open Code.gs, paste THIS file.
//   4) Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Who has access: Anyone.
//   5) Copy the /exec URL into RSVP_CONFIG.apiUrl in index.html.

var TAB_NAME = 'rsvp sheet';                      // exact name of the website-facing tab
var CLOSE_DATE = '2026-08-31T23:59:59-04:00';     // keep in sync with RSVP_CONFIG.closeDate
var ALLOWED_GENRES = [
  'Bollywood / Hindi', 'Punjabi & Bhangra', 'Telugu / Tollywood', 'Hip-Hop / R&B',
  'EDM / House', 'Western Pop', 'Classic / Retro Bollywood', 'Romantic & Slow',
  'Garba / Dandiya', '90s / 2000s Throwbacks'
]; // keep in sync with RSVP_CONFIG.genres in the website

// Fixed leading columns in the tab (1-based): Party ID | Party Name | Guest Count | Side | RSVP
var COL_ID = 1, COL_NAME = 2, COL_COUNT = 3;

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// The website-facing tab (case-insensitive match as a safety net).
function rsvpSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_NAME);
  if (!sh) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().trim().toLowerCase() === TAB_NAME.trim().toLowerCase()) { sh = all[i]; break; }
    }
  }
  if (!sh) throw new Error('Tab not found: ' + TAB_NAME);
  return sh;
}

// Find a header's 1-based column; append the column if it doesn't exist yet.
function colFor_(sh, header) {
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === header.toLowerCase()) return i + 1;
  }
  var col = lastCol + 1;
  sh.getRange(1, col).setValue(header);
  return col;
}

// Read parties from the tab — id, name, count, and the row they live on.
function readParties_() {
  var values = rsvpSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var id = values[i][COL_ID - 1], name = values[i][COL_NAME - 1], count = values[i][COL_COUNT - 1];
    if (id !== '' && name !== '') {
      out.push({ id: String(id), name: String(name), count: Number(count) || 0, row: i + 1 });
    }
  }
  return out;
}

// Guest-facing name lookup. Returns ONLY name + count — no contact info, no row.
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'lookup') {
    var q = (e.parameter.q) || '';
    var matches = matchParties(readParties_(), q).map(function (p) {
      return { id: p.id, name: p.name, count: p.count };
    });
    return jsonOut({ status: 'ok', matches: matches });
  }
  return jsonOut({ status: 'error', error: 'unknown_action' });
}

// Record an RSVP into the party's own row.
function doPost(e) {
  var payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch (err) { return jsonOut({ status: 'error', error: 'bad_json' }); }

  if (isClosed(new Date().toISOString(), CLOSE_DATE)) {
    return jsonOut({ status: 'closed' });
  }

  var parties = readParties_(), party = null;
  for (var i = 0; i < parties.length; i++) {
    if (parties[i].id === String(payload.partyId)) { party = parties[i]; break; }
  }
  var v = validateSubmission(party, payload.comingCount);
  if (!v.ok) return jsonOut({ status: 'error', error: v.error });

  var genres = parseGenres(payload.genres, ALLOWED_GENRES);
  var note = String(payload.note || '').slice(0, 500);

  var sh = rsvpSheet_();
  var colRsvp   = colFor_(sh, 'RSVP');
  var colComing = colFor_(sh, 'Coming Count');
  var colGenres = colFor_(sh, 'Genres');
  var colNote   = colFor_(sh, 'Note');
  var colWhen   = colFor_(sh, 'Submitted At');

  sh.getRange(party.row, colRsvp).setValue(v.count > 0 ? 'Attending' : 'Not attending');
  sh.getRange(party.row, colComing).setValue(v.count);
  sh.getRange(party.row, colGenres).setValue(genres.join(', '));
  sh.getRange(party.row, colNote).setValue(note);
  sh.getRange(party.row, colWhen).setValue(new Date());

  return jsonOut({ status: 'ok', count: v.count, party: party.name });
}
