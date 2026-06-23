# Apps Script Firestore Sync

This sample syncs vocabulary data from Google Sheets to Cloud Firestore for the study version of the app.

The web app does not read Google Sheets directly. It reads CSV text from Firestore:

```txt
privateWords/{vol}.csv
```

After editing Google Sheets, run this Apps Script first. Then use the app's `単語データ再読み込み` button to reload Firestore data in the browser.

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
   - `SYNC_TOKEN = the same string as the web app SHEET_SYNC_TOKEN`
6. Run `dryRun()` to confirm row counts without writing to Firestore.
7. Run `syncAllVolumesToFirestore()` or `syncVol1()` / `syncVol2()` / `syncVol3()` / `syncVol4()`.
8. Approve the required Apps Script permissions.
9. Check the Apps Script execution log for target volume, CSV row count, Firestore destination, `syncedAt`, and success or failure.

Do not paste service account private keys, access tokens, or other secrets into this repository. If your environment needs a different authentication setup, store secrets outside the repository, such as Apps Script Properties or another secure mechanism.

`CLIENT_EMAIL` and `PRIVATE_KEY` must be stored in Apps Script Script Properties. Do not write the real service account email, private key, access token, or service account JSON directly into `Code.gs` or any GitHub-tracked file.

If a real private key was committed even once, removing it from the repository is not enough. Delete or disable that service account key in Google Cloud Console and issue a new key before using it again.

## Web App Deployment

To let the browser app trigger sync:

1. Open the Apps Script editor.
2. Select Deploy.
3. Select New deployment.
4. Choose type: Web app.
5. Execute as: Me.
6. Choose access according to your private study operation.
7. Copy the Web App URL.
8. Set that URL in the web app's `syncConfig.js`.
9. Set the same lightweight token in Apps Script Properties `SYNC_TOKEN` and `syncConfig.js`.

The frontend token is not a strong secret because it is shipped to the browser. Treat it only as a lightweight guard for a personal study app. Firestore access control and service account permissions still matter.

`SYNC_TOKEN` is only a lightweight guard for this personal study version. The matching `SHEET_SYNC_TOKEN` in the web app can be visible in the browser, so it must not be treated like a server-side secret.

If browser fetch fails because of deployment or CORS-like access behavior, confirm the Web App URL, deployment access setting, and Apps Script execution logs first.

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
word,meaning,level
abandon,捨てる,vol1
expand,拡大する,vol2
```

Rows are split into `vol1`, `vol2`, `vol3`, and `vol4` by the configured `level` column.

`level` values such as `1`, `2`, `3`, `4`, `vol1`, `vol2`, `vol3`, and `vol4` are normalized before grouping.

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
