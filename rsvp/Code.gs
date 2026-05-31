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
