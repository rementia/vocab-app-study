/**
 * Integration test using ONLY the loopback Firestore emulator and synthetic data.
 * Hard-fails before any requests if the host or project isn't the isolated demo.
 * No production credentials, user backup files or deployed Firebase project.
 */
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";

const project = "demo-vocab-restore-ci";
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(emulator ?? "", /^(127\.0\.0\.1|localhost):8090$/,
  "Refusing to run outside the fixed local Firestore emulator");
const endpoint = "http://" + emulator + "/v1/projects/" + project +
  "/databases/(default)/documents";
const prefix = "projects/" + project +
  "/databases/(default)/documents/privateWords/";
const ids = ["vol1","vol2","vol3","vol4"];

async function request(url, method = "GET", data) {
  assert.ok(url.startsWith(endpoint), "Request outside local demo project");
  const response = await fetch(url,{
    method,
    ...(data ? {headers:{"Content-Type":"application/json"},body:JSON.stringify(data)} : {})
  });
  const body = await response.json().catch(() => ({}));
  return {status:response.status,ok:response.ok,body};
}
async function commit(writes, expectSuccess = true) {
  const result = await request(endpoint + ":commit", "POST", {writes});
  if (expectSuccess) {
    assert.equal(result.ok,true,"Local emulator commit failed: HTTP "+result.status);
    assert.equal(result.body.writeResults?.length,writes.length);
  } else {
    assert.equal(result.ok,false,"A stale updateTime must reject entire commit");
  }
  return result;
}
async function getAll() {
  const items = await Promise.all(ids.map(async id=>{
    const out = await request(endpoint+"/privateWords/"+id);
    assert.equal(out.ok,true,"Missing fixture document "+id);
    return out.body;
  }));
  return items;
}
const csvData = ids.map((id,i)=>
  "id,word,meaning\n" + "synthetic_"+id+",example"+i+",架空の意味"+i
);
function archiveFields(csv, i) {
  const encoded = i >= 2;
  const stored = encoded ? gzipSync(Buffer.from(csv)).toString("base64") : csv;
  return {
    csvEncoding:{stringValue:encoded?"gzip-base64":"plain"},
    uncompressedBytes:{integerValue:String(Buffer.byteLength(csv))},
    storedBytes:{integerValue:String(Buffer.byteLength(stored))},
    syncedAt:{timestampValue:"2026-10-01T00:00:00Z"},
    updatedAt:{timestampValue:"2026-09-15T00:00:00Z"},
    ...(encoded?{csvGzipBase64:{stringValue:stored}}:{csv:{stringValue:stored}})
  };
}
function writeCurrent(name,fields,currentFields,updateTime) {
  // Mask both old and new fields: restoring removes transient fields.
  const fieldPaths = [...new Set([...Object.keys(fields), ...Object.keys(currentFields)])].sort();
  return {
    update:{name,fields},
    updateMask:{fieldPaths},
    currentDocument:{updateTime}
  };
}
// 1. Create four isolated demo documents.
const initial = ids.map((id,i)=>({
  update:{name:prefix+id,fields:archiveFields(csvData[i],i)},
  currentDocument:{exists:false}
}));
await commit(initial);
const archived = await getAll();
assert.equal(archived.length,4);
assert.ok(archived.every((d,i)=>d.name===prefix+ids[i]));

// 2. Mutate local data, including changing CSV storage modes and adding a field.
const editedFields = structuredClone(archived[0].fields);
const newCsv = "id,word,meaning\nsynthetic_vol1,changed,改変済み";
editedFields.csvGzipBase64 = {stringValue:gzipSync(Buffer.from(newCsv)).toString("base64")};
editedFields.csvEncoding = {stringValue:"gzip-base64"};
editedFields.uncompressedBytes = {integerValue:String(Buffer.byteLength(newCsv))};
editedFields.storedBytes = {integerValue:String(Buffer.byteLength(editedFields.csvGzipBase64.stringValue))};
editedFields.transientField = {stringValue:"remove-during-restore"};
delete editedFields.csv;
await commit([writeCurrent(archived[0].name,editedFields,archived[0].fields,archived[0].updateTime)]);
const altered = await getAll();
assert.equal(altered[0].fields.csv,undefined);
assert.equal(altered[0].fields.transientField.stringValue,"remove-during-restore");

// 3. Restore all four documents atomically, preserving stored fields.
const restoring = archived.map((snap,i)=>
  writeCurrent(snap.name,snap.fields,altered[i].fields,altered[i].updateTime)
);
await commit(restoring);
const recovered = await getAll();
for(let i=0;i<4;i++) {
  assert.deepEqual(recovered[i].fields,archived[i].fields);
  assert.equal(recovered[i].fields.csvEncoding.stringValue,i>=2?"gzip-base64":"plain");
}
assert.equal(recovered[0].fields.transientField,undefined);
assert.equal(recovered[0].fields.csv.stringValue,csvData[0]);

// 4. A write between preflight and restore must reject the entire batch.
const stale = await getAll();
const changed = {...stale[1].fields, raceMarker:{stringValue:"concurrent edit"}};
await commit([writeCurrent(stale[1].name,changed,stale[1].fields,stale[1].updateTime)]);
const beforeRejected = await getAll();
const optimisticRestore = archived.map((snap,i)=>
  writeCurrent(snap.name,snap.fields,beforeRejected[i].fields,stale[i].updateTime)
);
const conflict = await commit(optimisticRestore,false);
assert.ok(conflict.status >= 400);
const afterRejected = await getAll();
for(let i=0;i<4;i++) {
  assert.deepEqual(afterRejected[i].fields,beforeRejected[i].fields,
    "A rejected atomic commit must not partially overwrite vol"+(i+1));
}
assert.equal(afterRejected[1].fields.raceMarker.stringValue,"concurrent edit");
process.stdout.write("Isolated Firestore emulator: 4 document restore, field masks, readback, and stale-precondition atomic rejection passed.\n");
