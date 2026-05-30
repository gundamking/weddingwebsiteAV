# RSVP Feature — Design

**Date:** 2026-05-30
**Site:** Anjani & Varun wedding (single-file custom HTML), domain `avtietheknot.com`
**Status:** Design for review

## Goal

Replace the current static RSVP form with an interactive, data-backed RSVP:
a guest types their **party name**, their party is found, they pick **how many of
their allocated seats are coming** (0–N), select **music genres** (multi-select,
one set per party), and submit. The couple privately reviews the aggregated
responses (headcount + music) to plan the vibe/playlist. RSVP closes on a date (TBD).

## Decisions (locked)

- **Hosting:** only the **domain** was purchased. Host this custom HTML free on
  **Cloudflare Pages or Netlify**; point `avtietheknot.com` DNS at it. Squarespace
  used only as registrar. Site design unchanged.
- **Backend:** a dedicated **RSVP Google Sheet** + a **Google Apps Script Web App**
  as the read/write API.
- **Attendance model:** **count only** — a party picks how many of its N seats are
  coming. No per-seat names, no headshots, no +1s beyond the allocation.
- **Scope:** **Day 1+2 (main wedding) only.** Day 0 and US events are out of scope
  for the public RSVP (the couple tracks those privately).
- **Music:** **multi-select genres**, one set per party. Final genre list pending
  from couple (config array — see Open config).
- **Re-submit:** allowed (latest overwrites) until the close date.
- **Vibe view:** **couple-only / private** — via the RSVP Sheet's `Responses` tab
  with filter views. No public response browsing, no custom admin screen.

## Source data & required data prep

The couple's `Attendee List.xlsx` is the **private planning workbook**:
tabs `Bride Side`, `Groom Side`, `Karjat Groom Side`; each **row is a party**
(`Name · Category · Email · Phone · Guest Count · Room Count · RSVP status (Day 1+2)
· RSVP status (Day 0) · RSVP status (US) · Notes`). It contains phone numbers,
emails, and internal planning notes and **must not** be the live backend.

**Prep:** build a separate, clean **RSVP Google Sheet** containing only the public
fields, by consolidating the planning tabs into one deduped party list
(resolve the near-duplicate `Groom Side` vs `Karjat Groom Side` — use the correct
Day 1+2 set) with **only** `Party Name` + `Guest Count`. The assistant can generate
a first-pass consolidated CSV from the xlsx for the couple to clean and upload.

## Architecture

### RSVP Google Sheet (one workbook, two tabs)

- **`Parties`** (source of truth, no PII):
  `Party ID · Party Name · Guest Count`
  One row per party eligible for Day 1+2.
- **`Responses`** (written by the app):
  `Timestamp · Party ID · Coming Count · Genres · Note (optional)`
  Re-submit overwrites the party's latest response, keyed by `Party ID`.

No phone/email/notes ever live in this sheet, so lookups cannot leak PII.

### API — Google Apps Script Web App

Bound to the RSVP Sheet, deployed **"execute as me, anyone can access."**
Dispatched by `?action=`:

- **`lookup`** (GET): `?action=lookup&q=<name>` → debounced search of `Parties` →
  returns matching party (`Party ID`, `Party Name`, `Guest Count`) only.
- **`submit`** (POST, `Content-Type: text/plain` to avoid CORS preflight):
  body `{ partyId, comingCount, genres, note }` → validates the party exists,
  `0 ≤ comingCount ≤ Guest Count`, and now < close date → writes/overwrites the
  `Responses` row → returns `{status: ok|closed|error}` JSON.

The **close date** is one configurable constant in the script (server-enforced),
mirrored by a client banner.

### Widget (in the HTML, replaces the existing RSVP form)

Built in the site's existing React-in-Babel style. Flow:
1. Guest types party name → debounced `lookup`.
2. Party card renders: party name + "You have **N** seats for the wedding."
   Handle no-match and multiple-match (let them pick the right party).
3. **Coming count** selector: 0 … N.
4. **Multi-select genre chips** (one set per party).
5. Optional short note box.
6. Submit → `submit` → confirmation; re-submit updates the same party.
7. After the close date: "RSVPs are now closed" banner; submission disabled.

### Couple's private vibe view

The RSVP Sheet's `Responses` tab with **filter views** (filter by genre, sort by
count). No code.

## Security / privacy

- `lookup` returns party name + seat count only; no PII in the RSVP sheet at all.
- No public browsing of responses (couple-only via the Sheet).
- **No authentication:** anyone who knows a party's name can submit for it.
  Accepted as standard for a wedding site; documented explicitly.

## Out of scope (YAGNI)

- Per-event RSVP (Day 0 / US), per-seat attendee names, headshots, +1 entry.
- Public/social "see who's coming" view; custom admin dashboard.
- Login/accounts; email confirmations.

## Testing

- Apps Script: manual verification against a **test copy** of the RSVP sheet —
  lookup (match / no-match / multi-match), submit (new / re-submit overwrite,
  count bounds), close-date rejection.
- Widget: manual run on the local server against the test sheet; verify CORS-free
  submit, error/closed states.

## Open config (non-blocking)

- **Genre list** — final values from the couple.
- **RSVP close date** — TBD; set the script constant when decided.
- **Cloudflare Pages vs Netlify** — functionally equivalent for a static site.
