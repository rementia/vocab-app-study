# Apps Script Firestore Sync

This sample syncs vocabulary data from Google Sheets to Cloud Firestore for the study version of the app.

The web app does not read Google Sheets directly. It reads CSV text from Firestore:

```txt
privateWords/{vol}.csv
```

After editing Google Sheets, run this Apps Script first. Then use the app's `単語更新` button to reload Firestore data in the browser.

## Firestore Output

The script writes this shape:

```txt
privateWords
  vol1
    csv: "word,meaning,..."
    syncedAt: "2026-06-20T12:34:56.000Z"
  vol2
    csv: "word,meaning,..."
    syncedAt: "2026-06-20T12:34:56.000Z"
  vol3
    csv: "word,meaning,..."
    syncedAt: "2026-06-20T12:34:56.000Z"
  vol4
    csv: "word,meaning,..."
    syncedAt: "2026-06-20T12:34:56.000Z"
```

The `csv` field is required by the web app. The `syncedAt` field is optional, but useful because the app can show it after word data reload.

## Setup

1. Open Google Apps Script from the vocabulary spreadsheet.
2. Paste `Code.gs` into the Apps Script editor.
3. Set `CONFIG.firebaseProjectId`.
4. Choose the sheet layout in `CONFIG.mode`.
5. Set Script Properties:
   - `CLIENT_EMAIL = service account JSON client_email`
   - `PRIVATE_KEY = service account JSON private_key`
   - `SYNC_TOKEN = a server-side secret only if you retain the legacy doPost endpoint; never copy this into browser JavaScript or GitHub`
6. Run `dryRun()` to confirm row counts **without writing to Google Sheets or Firestore** (requires the proposed Apps Script version to be deployed).
7. Run `syncAllVolumesToFirestore()` or `syncVol1()` / `syncVol2()` / `syncVol3()` / `syncVol4()`.
8. Approve the required Apps Script permissions.
9. Check the Apps Script execution log for target volume, CSV row count, Firestore destination, `syncedAt`, and success or failure.

Do not paste service account private keys, access tokens, or other secrets into this repository. If your environment needs a different authentication setup, store secrets outside the repository, such as Apps Script Properties or another secure mechanism.

`CLIENT_EMAIL` and `PRIVATE_KEY` must be stored in Apps Script Script Properties. Do not write the real service account email, private key, access token, or service account JSON directly into `Code.gs` or any GitHub-tracked file.

If a real private key was committed even once, removing it from the repository is not enough. Delete or disable that service account key in Google Cloud Console and issue a new key before using it again.

## Web App Deployment (optional; currently unused by the app UI)

The current `index.html` → `bootstrap.js` → `app.js` flow does not invoke the Apps Script Web App. The `単語更新` button only reloads Firestore. For routine personal sync, use the Apps Script editor to run `syncAllVolumesToFirestore()` after checking source data, then reload the app.

The legacy `doPost()` endpoint accepts `SYNC_TOKEN` from a request and, when valid, runs a privileged Firestore sync using service credentials stored in Script Properties. If the Web App is deployed to execute **as the owner** with access **to everyone**, a leaked token may allow others to start that privileged operation. Do not expose the token or privileged Web App URL in frontend code, a public repository, documentation or issues.

Before maintaining or re-enabling remote calls, verify the actual deployed script version, allowed callers, access settings and dependencies. Use a server-side authorization design that does not rely on a browser-distributed shared token. Treat any historically exposed token as compromised and rotate/revoke it in the actual Apps Script environment, after planning updates for legitimate callers. Git history and old Hosting releases may continue to contain historical values.

If the browser needs direct secure synchronization in the future, implement an authenticated server-side endpoint with appropriate user permissions and abuse controls; do not restore a token to `syncConfig.js`.

## Authentication Note

`Code.gs` creates an OAuth access token from a service account email and private key stored in Apps Script Properties. The service account must have permission to write Firestore documents in the Firebase project.

If Firestore returns `403` or an authorization error, check:

- `CONFIG.firebaseProjectId`
- Script Properties `CLIENT_EMAIL`
- Script Properties `PRIVATE_KEY`
- Script Properties `SYNC_TOKEN`
- whether `PRIVATE_KEY` keeps `\n` line breaks correctly
- Firestore IAM permissions for the service account

## Sheet Layouts

### sheetsByVolume

Use one sheet per volume:

```txt
vol1
vol2
vol3
vol4
```

Each sheet's first row is treated as the CSV header.

### singleSheetWithLevel

Use one sheet, for example `words`, with a `level` column:

```txt
word,meaning,level,morpheme,morphemeMeaning,semanticDevelopment,partOfSpeech,semanticCategory
abandon,捨てる,vol1,a- + bandon,away + control,支配から離して手放す,verb,action_activity
expand,拡大する,vol2,ex- + pand,out + spread,外へ広げる,verb,change
```

Rows are split into `vol1`, `vol2`, `vol3`, and `vol4` by the configured `level` column.

`level` values such as `1`, `2`, `3`, `4`, `vol1`, `vol2`, `vol3`, and `vol4` are normalized before grouping.

The single-sheet export keeps these optional study columns when present: `morpheme`, `morphemeMeaning`, `semanticDevelopment`, `partOfSpeech`, and `semanticCategory`. Missing optional columns are exported as blank cells so older sheets remain compatible.


## Stable Word IDs

The Apps Script manages a stable `id` column in Google Sheets before exporting CSV to Firestore.

- If the sheet does not have an `id` column, the script creates one.
- If a row already has an `id`, the script never overwrites it.
- If a row has an empty `id`, the script generates a new internal ID such as `w_abcd1234efgh`.
- If duplicate IDs are found, the sync stops with an error before writing to Firestore.
- The exported Firestore CSV includes the `id` column, and the web app uses it as the internal word key.
- If `id` is missing or blank in CSV, the web app falls back to the old word-derived key.

In Google Sheets, hide and protect the `id` column so normal vocabulary edits do not accidentally change word identity. Changing an existing `id` can disconnect favorites, difficult words, and review history from that word.

## Validation and failure boundaries

- The revised script validates unknown volume levels, cross-volume duplicate IDs, missing classifications, and empty target volumes before starting a normal sync. An invalid or empty volume aborts rather than overwriting Firestore with incomplete data.
- After preflighting all four CSV payloads, a full sync uses Firestore REST `documents:commit` with a masked write for each volume. Firestore applies all four document writes atomically: if any fails, none are committed. Single-volume sync uses the same endpoint with one write.
- All actual synchronization runs (including single-volume and legacy remote calls) take an Apps Script **script lock** before reading source data, saving generated IDs, or committing to Firestore. Contention aborts safely after a 30-second attempt, and the lock is released on success or failure. This prevents overlapping sync jobs in this Apps Script project, **not** simultaneous manual spreadsheet edits or syncs from other projects. `dryRun()` remains read-only and does not lock.
- `dryRun()` is a no-write preview: it does not create the `id` column or persist generated IDs to Google Sheets, and it does not change Firestore.
- Google Sheets stable-ID writes are still separate, non-atomic cell updates. The script now checks every target cell before writing, and flushes and verifies each saved ID before any Firestore commit. If a Sheets write fails or its readback differs, the script aborts **before** Firestore sync. Already-written IDs may remain in Sheets and can be reused on a later run; the Sheets and Firestore updates are not one cross-service transaction. Back up both systems before production rollout and verify each volume after sync.
- Changes to this GitHub code do **not** automatically replace the active Apps Script editor project or its existing deployed Web App version. Validate the actual Apps Script installation separately before applying them.

## Firebase Security Rules: repository versus production

The GitHub `firestore.rules` file is a **proposed source definition**, not evidence of deployed production rules. The repository's `.github/workflows/firebase-hosting-merge.yml` and Hosting Preview workflow use Firebase Hosting deployment actions, which **do not publish Firestore Security Rules**. Do not infer rules status from a successful Hosting workflow.

Before production approval, open Firebase Console > Firestore Database > Rules and compare the **deployed** rules with the intended access policy. In source, `privateUsers/{uid}` is restricted to the authenticated matching UID; `privateWords/{vol}` is readable by any authenticated Firebase user and client writes are denied. The latter is shared study data, **not owner-only**. Any deliberate change to production rules requires a separate change-risk review and authorized deployment; this draft PR does not deploy rules or change access.

Deleting the previously exposed Apps Script `SYNC_TOKEN` property should make the version-controlled `validateSyncToken()` reject legacy Web App POST requests, but the **actual deployed Apps Script version must be checked separately**. Source-code tests do not prove revocation in production; do not test by triggering a privileged full sync on live data.

## Firebase Console Check

After running the script, confirm these values in Firebase Console:

1. Firestore Database
2. `privateWords`
3. `vol1` / `vol2` / `vol3` / `vol4`
4. `csv`
5. `syncedAt`

If `privateWords/{vol}.csv` is not updated, the app's reload button will still show the old vocabulary data.

## Common Mistakes

- Writing to a collection other than `privateWords`
- Writing to `Vol1`, `volume1`, or another document ID instead of `vol1`
- Saving the CSV into `words`, `data`, or `text` instead of `csv`
- Editing Google Sheets but not running Apps Script
- Not approving Apps Script permissions
- Missing `CLIENT_EMAIL` or `PRIVATE_KEY` in Apps Script Properties
- Using a service account that cannot write to the Firebase project's Firestore database
- Mismatching sheet names or column names with `CONFIG`
