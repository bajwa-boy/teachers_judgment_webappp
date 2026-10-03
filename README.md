# SD College Judging Studio

Phone-first React app with a Node server. Judges select their name without a login; their device receives an HttpOnly session cookie. Organisers use a server-side password.

## Local preview

1. `npm install`
2. `npm run dev`
3. Open http://localhost:5173. On phones connected to the same Wi-Fi, use this computer's LAN IP with port 5173 (Windows firewall may need to allow the server).

Without Supabase credentials, the app explicitly runs in local preview mode. Scores persist in `.local-data.json` on this computer. An automatically generated local admin password appears in the server output unless ADMIN_PASSWORD is configured. Organiser access is at `/admin`.

To clear trial data, stop the preview server, run `node reset-preview.mjs`, then restart it. The previous local data is copied to `.preview-backup.json`. The script refuses to run when a Supabase URL is configured.

## Supabase and event deployment

1. Create a Supabase project and run `supabase.sql` in its SQL Editor.
2. Copy `.env.example` to `.env`, then set SUPABASE_URL, SUPABASE_SECRET_KEY and a strong ADMIN_PASSWORD. Use a Supabase server secret key; never a frontend VITE variable. All database access goes through the Node server. RLS and function grants block direct anonymous access.
3. `npm run build`, then `npm start` on a Node-capable HTTPS host. Production refuses to start without Supabase and an admin password. Host the app and its API together; configure the proxy to preserve the original Host header.
4. Before the event, verify all 16 entries on a phone, perform a trial with multiple devices and a separate Supabase test project, then use a fresh event database. Export scores from the organiser panel for a local backup. Supabase free-tier backup availability is plan dependent; CSV export is included.

## Event rules

- Each judge scores all entries across seven criteria, totalling 100.
- Same roll number submissions are grouped, retaining each original poster.
- Names are claimed atomically. The organiser can release a lost device while keeping its scores.
- Saving waits for the server. Network failures keep the form and local draft available for retry; offline submissions are not silently accepted.
- Scores can be reviewed and edited until the last required evaluation is saved. That database transaction publishes results and locks scores and judge additions.
- Ranking uses combined totals; average is total divided by judge count. Ties use competition ranking (1, 1, 3).
- The organiser should add all judges before judging finishes.
- Admin progress refreshes every five seconds. CSV export contains every judge's individual criterion marks.
- Ayush Arora's course and roll number are missing from the source filename. Update `students.json` after confirming them. Arshpreet's two files list BCA AI and BCA respectively; confirm the course.

## Files

`students.json` seeds the roster once. The active roster then lives alongside scores in Supabase (or the local preview file). Manage entries in the organiser panel rather than editing the seed after judging starts. `public/poster-*` are copies with detected PDF/PNG/JPG extensions; original files are untouched. `prepare.mjs` reproduces the seed manifest and assets from the originals.

## Student management

After upgrading from the initial database setup, rerun the current `supabase.sql` in SQL Editor. It replaces the saving function and creates the `posters` Storage bucket without resetting existing event records. At connection time, the app copies the initial roster into the event record if absent.

Organisers can add students with 1–6 PDF/PNG/JPEG files, edit metadata, search entries and remove students from the active event. Uploads are limited to 15 MB per file and checked by file signature. Cloud uploads go to Supabase Storage through the authenticated admin server route; local preview uploads go to `public/uploads`. Same roll numbers cannot be added twice. Metadata edits preserve marks and posters. Deleted entries and their saved marks are archived in the event record, and excluded from progress/ranking. There is no archive restore UI yet. The last remaining entry cannot be removed. Adding entries adds work for every judge; deleting an entry may publish results if all remaining work is complete. Entries lock once results publish.

## Checks

`npm test` checks claims, score validation, overwrite behavior, final locking and ties. `npm run build` checks the production frontend build.

No cloud project has been provisioned automatically. Cloud behavior must be verified after the Supabase project is configured.
