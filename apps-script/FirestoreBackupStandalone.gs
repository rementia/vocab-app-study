/**
 * ONE-OFF FIRESTORE BACKUP HELPER - for the existing Apps Script project.
 *
 * Safe to add as a separate .gs file without replacing the deployed Code.gs.
 * Run ONLY backupFirestoreWordsToDrive() manually from the Script editor.
 * Requires the existing CONFIG and getAccessToken() from Code.gs.
 *
 * Reads exactly four privateWords documents via Firestore GET.
 * Creates ONE new private JSON file in the owner's My Drive.
 * NEVER writes to Firestore or the vocabulary spreadsheet.
 * Never restore or republish the old SYNC_TOKEN.
 *
 * This file is a draft; real deployment and restore have not been verified.
 */
function backupFirestoreWordsToDrive() {
  var collection = "privateWords";
  var docIds = ["vol1", "vol2", "vol3", "vol4"];
  if (!CONFIG || CONFIG.firebaseProjectId !== "svl-app-65204") {
    throw new Error("想定外のFirebaseプロジェクトです。バックアップを中止しました。");
  }
  if (CONFIG.collectionName !== collection) {
    throw new Error("想定外のFirestoreコレクションです。");
  }

  // The pre-existing service account token is obtained from Script Properties.
  // Never log the token or the service-account private key.
  var accessToken = getAccessToken();
  var projectPrefix = "projects/" + CONFIG.firebaseProjectId +
    "/databases/(default)/documents/" + collection + "/";
  var results = [];

  // Fetch ALL documents before creating a backup file. If one fails,
  // no partial archive is deliberately created.
  docIds.forEach(function (docId) {
    var expectedName = projectPrefix + docId;
    var url = "https://firestore.googleapis.com/v1/" + expectedName;
    var response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + accessToken },
      muteHttpExceptions: true
    });
    var status = response.getResponseCode();
    if (status !== 200) {
      throw new Error(docId + ": Firestore読取失敗 HTTP " + status +
        "。不完全なバックアップは作成しません。");
    }

    var document;
    try {
      document = JSON.parse(response.getContentText());
    } catch (error) {
      throw new Error(docId + ": Firestoreレスポンスが不正です。");
    }
    if (!document || document.name !== expectedName || !document.fields) {
      throw new Error(docId + ": 期待する文書名・フィールドと一致しません。");
    }
    var fields = document.fields;
    var validData =
      (fields.csv && typeof fields.csv.stringValue === "string") ||
      (fields.csvGzipBase64 &&
        typeof fields.csvGzipBase64.stringValue === "string");
    if (!validData) {
      throw new Error(docId + ": CSV格納フィールドがありません。");
    }
    results.push(document); // Retain all fields, timestamps and encodings.
  });

  if (results.length !== 4) {
    throw new Error("バックアップ対象が4巻に揃っていません。");
  }

  var now = new Date().toISOString();
  var fileName = "svl-privateWords-4vol-backup-" +
    now.replace(/[:.]/g, "-") + ".json";
  var archive = {
    schemaVersion: 1,
    createdAt: now,
    firebaseProjectId: CONFIG.firebaseProjectId,
    collectionName: collection,
    documentCount: results.length,
    documents: results
  };
  var blob = Utilities.newBlob(
    JSON.stringify(archive, null, 2), "application/json", fileName
  );
  var file = DriveApp.createFile(blob);
  // Files created in personal My Drive are private by default.
  // DriveApp.Permission.NONE cannot be passed with Access.PRIVATE to
  // setSharing(): do not call it. Check visibility immediately instead.
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    // Do not leave a newly created sensitive archive accessible by link.
    file.setTrashed(true);
    throw new Error("Driveの共有が非公開でないため、新規バックアップをゴミ箱へ移しました。");
  }
  var fileUrl = file.getUrl();
  Logger.log("Firestore 4巻バックアップ作成: " + file.getName());
  Logger.log("Google DriveバックアップURL: " + fileUrl);
  Logger.log("Driveでファイルの内容・非公開設定を確認してください。");
  return {
    fileName: file.getName(),
    fileUrl: fileUrl,
    documentCount: results.length
  };
}
