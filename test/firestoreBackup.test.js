import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInContext, createContext } from "node:vm";

const source = readFileSync(
  new URL("../apps-script/FirestoreBackupStandalone.gs", import.meta.url),
  "utf8"
);

function fixture({ errorAt = -1, malformedAt = -1, wrongNameAt = -1, publicOnCreate = false } = {}) {
  const ids = ["vol1", "vol2", "vol3", "vol4"];
  const prefix =
    "projects/svl-app-65204/databases/(default)/documents/privateWords/";
  const network = [];
  const created = [];
  const messages = [];
  const ctx = createContext({
    CONFIG: {
      firebaseProjectId: "svl-app-65204",
      collectionName: "privateWords"
    },
    getAccessToken: () => "test-token-only",
    UrlFetchApp: {
      fetch: (url, options) => {
        network.push({ url, method: options.method, hasAuth:
          options.headers.Authorization === "Bearer test-token-only" });
        const name = url.replace("https://firestore.googleapis.com/v1/", "");
        const i = ids.findIndex(id => name === prefix + id);
        assert.notEqual(i, -1);
        assert.equal(options.method, "get");
        return {
          getResponseCode: () => i === errorAt ? 403 : 200,
          getContentText: () => i === malformedAt ? "not-json" :
            JSON.stringify({
              name: prefix + (i === wrongNameAt ? "WRONG" : ids[i]),
              createTime: "2026-10-01T00:00:00Z",
              updateTime: "2026-10-12T00:00:00Z",
              fields: {
                csvEncoding: { stringValue: "plain" },
                csv: { stringValue: "id,word\\nw_1,test" },
                syncedAt: { timestampValue: "2026-10-12T00:00:00Z" },
                unrelatedField: { stringValue: "must-preserve" }
              }
            })
        };
      }
    },
    Utilities: { newBlob: (data, type, name) => ({ data, type, name }) },
    DriveApp: {
      Access: { PRIVATE: "private" },
      Permission: { NONE: "none" },
      createFile: (blob) => {
        const state = {
          blob,
          visibility: publicOnCreate ? "link-read" : "private",
          trashed: false
        };
        created.push(state);
        return {
          getSharingAccess: () => state.visibility,
          setTrashed(value) { state.trashed = value; },
          getName: () => blob.name
        };
      }
    },
    Logger: { log: (message) => messages.push(message) }
  });
  runInContext(source, ctx, { filename: "FirestoreBackupStandalone.gs" });
  return {
    run: () => runInContext("backupFirestoreWordsToDrive()", ctx),
    network, created, messages, ctx
  };
}

{
  const t = fixture();
  const output = t.run();
  assert.equal(output.documentCount, 4);
  assert.equal(t.network.length, 4);
  assert.ok(t.network.every(x => x.method === "get" && x.hasAuth));
  assert.equal(t.created.length, 1);
  assert.equal(t.created[0].visibility, "private");
  assert.equal(t.created[0].trashed, false);
  const archive = JSON.parse(t.created[0].blob.data);
  assert.equal(archive.documentCount, 4);
  assert.deepEqual(
    Array.from(archive.documents, doc => doc.name.split("/").at(-1)),
    ["vol1", "vol2", "vol3", "vol4"]
  );
  assert.ok(archive.documents.every(doc =>
    doc.fields.unrelatedField.stringValue === "must-preserve"
  ));
  assert.doesNotMatch(t.created[0].blob.data, /test-token-only/);
}
for (const kind of ["errorAt", "malformedAt", "wrongNameAt"]) {
  const t = fixture({ [kind]: 2 });
  assert.throws(t.run);
  assert.equal(t.created.length, 0, kind + " must not create partial backup");
  assert.equal(t.network.length, 3);
  assert.ok(t.network.every(x => x.method === "get"));
}
{
  const t = fixture();
  t.ctx.CONFIG.firebaseProjectId = "unexpected-project";
  assert.throws(t.run, /想定外のFirebaseプロジェクト/);
  assert.equal(t.network.length, 0);
  assert.equal(t.created.length, 0);
}
{
  const t = fixture({ publicOnCreate: true });
  assert.throws(t.run, /新規バックアップをゴミ箱へ移しました/);
  assert.equal(t.created.length, 1);
  assert.equal(t.created[0].trashed, true);
  assert.ok(t.network.every(x => x.method === "get"));
}
console.log("Firestore read-only backup helper regression tests passed.");
