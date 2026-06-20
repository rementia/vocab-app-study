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
3. Set the Firebase Project ID:
   - replace `YOUR_FIREBASE_PROJECT_ID` in `CONFIG`, or
   - set Script Property `FIREBASE_PROJECT_ID`.
4. Choose the sheet layout in `CONFIG.mode`.
5. Confirm the Apps Script Google Cloud project can access Firestore.
6. Run `syncVocabularyToFirestore()`.
7. Approve the required Apps Script permissions.

Do not paste service account private keys, access tokens, or other secrets into this repository. If your environment needs a different authentication setup, store secrets outside the repository, such as Apps Script Properties or another secure mechanism.

## Authentication Note

`Code.gs` uses `ScriptApp.getOAuthToken()` with the Firestore REST API. The Apps Script project must be connected to a Google Cloud project that is allowed to write to the Firebase project's Firestore database.

If Firestore returns `403` or an authorization error, check:

- the Apps Script Google Cloud project
- Firestore IAM permissions
- Apps Script OAuth scopes, such as a Firestore/Cloud Platform scope required by your setup
- whether the Firebase Project ID in `CONFIG` or Script Properties is correct

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
- Using an Apps Script project that cannot access the Firebase project
- Mismatching sheet names or column names with `CONFIG`
