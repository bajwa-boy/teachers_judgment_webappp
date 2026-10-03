# Pre-deployment verification — 3 October 2026

The app is ready for deployment to a Node server with Supabase configured. A real phone check against the deployed HTTPS URL remains necessary; the local-network phone test was stopped at the user's request.

## Automated coverage

14 tests pass, covering multiple-device claims, simultaneous claim conflicts, separate scores, input limits, duplicate submissions/edits, releasing and reclaiming a judge, final completion, averages, tie ranking and post-result locks. They also cover admin login, failed-login throttling, rejected cross-origin writes, restricted uploads, student add/edit/archive, duplicate rolls, restart persistence, authorised CSV downloads and formula-safe exports.

All 19 bundled poster assets exist. All PDF pages decode; PNG dimensions and JPEG signatures are valid. Production checks verify app/asset delivery, path traversal rejection, secret-file protection and Secure/HttpOnly/SameSite admin cookies.

## Browser checks

An isolated three-entry event was used for mobile judging. Verified: PDF and image previews, zoom, invalid-score blocking, automatic totals, draft recovery after refresh, previous-score editing, Save & Next, automatic final results, 1/1/3 tied ranks, and locked organiser controls. Results were measured at viewport widths 360, 390, 768 and 1280 with no page overflow. No browser errors were recorded during that flow.

The browser automation could not confirm its download event for the original Blob export. Export was changed to an authenticated server response using the latest database snapshot, and its attachment headers and complete CSV contents are verified by HTTP tests.

## Live Supabase checks

The connected event contains 16 students and 3 judges. Read access and an unchanged student-metadata write passed, with identical event state returned. A temporary PDF uploaded to the posters bucket, downloaded identically via its public URL, and was removed afterward. The connected app's authenticated CSV export returned all 49 rows (header plus 16 × 3 evaluations). The production frontend was scanned against the locally configured server secret and admin password; neither appeared in client assets. No test students, judges or scores were added to the real event. Full score/result scenarios were tested on an isolated local event, not by submitting fake scores into the live database.

## Corrections made

- Network timeouts leave entered marks available for retry.
- A failed local draft cleanup no longer interrupts the UI after a successful score save.
- Expired admin sessions return to the login screen.
- Export fetches the latest server data and neutralises formula-like text.
- Mobile result columns fit without horizontal scrolling.
- Recovered network connections clear the old connection warning.

## Deployment and event notes

Use one Node service with Node 24 and the build/start commands in README. This app requires its Node API; uploading only `dist` to a static host is insufficient. Configure SUPABASE_URL, SUPABASE_SECRET_KEY and ADMIN_PASSWORD as server environment variables, and serve through HTTPS. Admin sessions are held by the running Node instance, so a restart requires admin login again; judge sessions and marks remain in Supabase. Multiple backend replicas would require shared admin sessions.

After deployment, verify the real phone link, one poster PDF, admin login and upload/export. Add all remaining entries/judges before every evaluation finishes: final results publish automatically and lock changes. Ayush Arora's course and roll number are still pending and can be corrected in the admin panel.
