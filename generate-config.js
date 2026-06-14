// Build step (runs on Vercel). Writes the gitignored runtime config file from the
// RSVP_API_URL environment variable, so the Apps Script /exec URL lives only in
// Vercel's project settings — never in this public repo. This script has no URL.
const fs = require('fs');

const url = process.env.RSVP_API_URL || '';
if (!url) {
  console.warn('⚠  RSVP_API_URL env var is not set — the RSVP form will be inert.');
}
fs.writeFileSync(
  'rsvp-config.local.js',
  '// Generated at build time from the RSVP_API_URL env var. Do not edit by hand.\n' +
  'window.RSVP_API_URL = ' + JSON.stringify(url) + ';\n'
);
console.log('Wrote rsvp-config.local.js — RSVP_API_URL ' + (url ? 'is set ✓' : 'is EMPTY'));
