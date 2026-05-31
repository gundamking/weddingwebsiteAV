# RSVP Deployment Guide

Everything the RSVP feature needs to go live. The site stays the same custom HTML;
the RSVP just talks to a Google Sheet through a small Apps Script web app.

There are two config values you'll want to decide first (both optional to start):
- **Genre list** — edit `ALLOWED_GENRES` in `rsvp/Code.gs` AND `RSVP_CONFIG.genres`
  in `Wedding Website.html`. They MUST match exactly.
- **RSVP close date** — set `CLOSE_DATE` in `rsvp/Code.gs` AND `RSVP_CONFIG.closeDate`
  in `Wedding Website.html` (same ISO value). Leave both `''` to stay open.

---

## 1. Create the RSVP Google Sheet (public-safe — NO phone/email)

1. Go to <https://sheets.new> and name it **"AV Wedding RSVP"**.
2. Rename the first tab to **`Parties`**. In row 1 put these exact headers:
   `Party ID | Party Name | Guest Count`
3. Import the guest list: **File ▸ Import ▸ Upload**, choose `rsvp/parties.csv`,
   Import location **"Replace current sheet"**, then Import.
   - This file holds only party name + seat count — no contact info. Good.
   - If you edited parties by hand, just make sure the 3 columns/headers match.
4. Add a second tab named **`Responses`**. In row 1 put these exact headers:
   `Timestamp | Party ID | Coming Count | Genres | Note`
   (Leave the rest empty — the script fills it in.)
5. Copy the **Sheet ID** from the URL. In
   `https://docs.google.com/spreadsheets/d/`**`THIS_LONG_ID`**`/edit`
   the bold part is your Sheet ID.

---

## 2. Deploy the Apps Script API

1. In the sheet, open **Extensions ▸ Apps Script**.
2. You'll see a default `Code.gs`. Create a second script file:
   click the **+** next to "Files" ▸ **Script** ▸ name it **`logic`**
   (Apps Script will call it `logic.gs`).
3. Open `logic.gs`, delete its contents, and paste the **entire contents of
   `rsvp/logic.js`**. Save.
4. Open `Code.gs`, delete its contents, and paste the **entire contents of
   `rsvp/Code.gs`**. Save.
5. At the top of `Code.gs`, set the config:
   - `SHEET_ID` → the Sheet ID from step 1.5.
   - `CLOSE_DATE` → your close date as ISO, e.g. `'2026-09-01T23:59:59-04:00'`,
     or leave `''` to stay open.
   - Confirm `ALLOWED_GENRES` matches `RSVP_CONFIG.genres` in the website.
6. Deploy: **Deploy ▸ New deployment ▸** gear icon ▸ **Web app**.
   - Description: `RSVP API`
   - **Execute as: Me**
   - **Who has access: Anyone**
   - Click **Deploy**, then **Authorize access** and approve the Google prompts
     (it will warn the app is unverified — that's expected for your own script;
     choose Advanced ▸ Go to project ▸ Allow).
7. Copy the **Web app URL** — it ends in `/exec`. This is your API URL.

> Re-deploying after edits: use **Deploy ▸ Manage deployments ▸** (pencil) ▸
> **Version: New version ▸ Deploy**. The `/exec` URL stays the same.

---

## 3. Wire the website to the API

In `Wedding Website.html`, find the `RSVP_CONFIG` block (near the RSVP component)
and set:
- `apiUrl` → the `/exec` URL from step 2.7.
- `closeDate` → the same ISO value as `CLOSE_DATE` (or `''`).
- `genres` → must match `ALLOWED_GENRES` in `Code.gs`.

Test locally before hosting: run `python -m http.server 8000` in the repo, open
<http://localhost:8000/Wedding%20Website.html#rsvp>, type a known party name, and
confirm it appears and submitting writes a row to the **Responses** tab.

---

## 4. Host the site + point the domain

You own the domain `avtietheknot.com` (registrar: Squarespace). Host the static
files for free and point the domain at the host.

**Cloudflare Pages (recommended) or Netlify — either works:**
1. Push this repo to GitHub.
2. Create a project from the repo. Framework preset: **None**.
   Build command: **(leave empty)**. Output directory: **/** (repo root).
3. Deploy. You'll get a temporary URL — confirm the site loads there.
4. Add the custom domain **avtietheknot.com** in the host's domain settings.
5. In **Squarespace ▸ Domains ▸ avtietheknot.com ▸ DNS settings**, add the
   records the host gives you (typically a `CNAME` for `www` and either an `A`
   record or `CNAME` for the apex/root). Squarespace stays ONLY the registrar.
6. Wait for DNS to propagate (minutes to a few hours), then load
   `https://avtietheknot.com` and re-test the RSVP end-to-end.

> The guest's main page URL is `…/Wedding Website.html`. If you want it to be the
> root (just `avtietheknot.com`), rename/copy it to `index.html` before hosting,
> or set the host's default route — optional, decide when hosting.

---

## 5. Reading responses (couple-only "vibe" view)

No separate dashboard — use the Sheet:
1. Open the **Responses** tab.
2. **Data ▸ Create a filter view** (so guests-of-edit-access don't disturb each
   other; or just use a normal filter since only you two have access).
3. Filter the **Genres** column to see who wants which music; sort **Coming
   Count** to total attendance. That's your playlist/vibe planner.

---

## 6. Privacy reminders

- The RSVP Sheet contains **no phone numbers or emails** — only party names +
  counts + their own submitted answers. Keep it that way.
- `Attendee List.xlsx` (your private planning workbook with contacts) is
  **git-ignored** and must never be committed or uploaded to the public host.
- The API has no login: anyone who knows a party's name can RSVP for it. That's
  standard for a wedding site and acceptable here.

---

## Quick reference

| Thing | Where |
|---|---|
| Guest list (public) | `rsvp/parties.csv` → Sheet **Parties** tab |
| Responses land in | Sheet **Responses** tab |
| Backend logic | `rsvp/logic.js` → Apps Script `logic.gs` |
| Backend API | `rsvp/Code.gs` → Apps Script `Code.gs` |
| API URL + close date + genres | `RSVP_CONFIG` in `Wedding Website.html` |
| Server close date + genres + Sheet ID | top of `rsvp/Code.gs` |
