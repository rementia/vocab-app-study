/** OFFLINE ONLY: no network, Firebase auth or write operations. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

const ids = ["vol1", "vol2", "vol3", "vol4"];
const prefix = "projects/svl-app-65204/databases/(default)/documents/privateWords/";
function check(ok, message) {
  if (!ok) throw new Error("Backup invalid: " + message);
}
function parseCsv(text) {
  let row = [], cell = "", quoted = false;
  const out = [];
  for (let i=0; i<text.length; i++) {
    const ch=text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i+1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      check(cell === "", "malformed CSV quote");
      quoted = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n") {
      row.push(cell); out.push(row); row=[]; cell="";
    } else if (ch === "\r" && text[i+1] === "\n") {
      row.push(cell); out.push(row); row=[]; cell=""; i++;
    } else {
      check(ch !== "\r", "malformed CSV line ending"); cell += ch;
    }
  }
  check(!quoted, "unterminated CSV quote");
  if (row.length || cell) { row.push(cell); out.push(row); }
  return out;
}

export function inspectFirestoreArchive(archive) {
  check(archive?.schemaVersion === 1, "schema");
  check(archive.firebaseProjectId === "svl-app-65204" &&
        archive.collectionName === "privateWords", "project/collection");
  check(archive.documentCount === 4 && Array.isArray(archive.documents) &&
        archive.documents.length === 4, "document count");
  const names = new Set(), wordIds = new Set(), volumes = [];
  const syntheticWrites = [];
  for (const doc of archive.documents) {
    check(typeof doc?.name === "string" && doc.name.startsWith(prefix), "document path");
    const id=doc.name.slice(prefix.length);
    check(ids.includes(id) && !names.has(id), "volume id or duplicate");
    names.add(id);
    const f=doc.fields;
    check(f && typeof f === "object", id + ": fields missing");
    check(typeof f.syncedAt?.timestampValue === "string", id + ": syncedAt");
    const encoding=f.csvEncoding?.stringValue;
    let csv, storedBytes;
    if (encoding === "plain") {
      check(typeof f.csv?.stringValue === "string" &&
        f.csvGzipBase64 === undefined, id + ": invalid plain fields");
      csv=f.csv.stringValue;
      storedBytes=Buffer.byteLength(csv,"utf8");
    } else if (encoding === "gzip-base64") {
      const b64=f.csvGzipBase64?.stringValue;
      check(typeof b64 === "string" && f.csv === undefined &&
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64), id + ": base64 fields");
      let bytes;
      try { bytes=gunzipSync(Buffer.from(b64,"base64")); }
      catch { throw new Error("Backup invalid: " + id + ": gzip corrupted"); }
      csv=bytes.toString("utf8");
      check(Buffer.from(csv,"utf8").equals(bytes), id + ": invalid UTF-8");
      storedBytes=Buffer.byteLength(b64,"utf8");
    } else throw new Error("Backup invalid: " + id + ": unknown encoding");
    check(String(storedBytes) === f.storedBytes?.integerValue &&
      String(Buffer.byteLength(csv,"utf8")) === f.uncompressedBytes?.integerValue,
      id + ": size mismatch");
    check(storedBytes <= 900000, id + ": document too large");
    const rows=parseCsv(csv);
    check(rows.length > 1 && rows[0].length === 12 &&
      rows[0][0] === "id" && rows[0][1] === "word" && rows[0][2] === "meaning",
      id + ": bad CSV header");
    for(const row of rows.slice(1)) {
      check(row.length === 12 && row[0]?.trim() && row[1]?.trim() && row[2]?.trim(),
        id + ": bad CSV row");
      check(!wordIds.has(row[0]), id + ": duplicate word ID");
      wordIds.add(row[0]);
    }
    syntheticWrites.push({update:{name:doc.name,fields:structuredClone(f)}, currentDocument:{exists:true}});
    volumes.push({
      id, words:rows.length-1, encoding, storedBytes,
      csvSha256:createHash("sha256").update(csv,"utf8").digest("hex"),
      syncedAt:f.syncedAt.timestampValue,
      fieldNames:Object.keys(f).sort()
    });
  }
  check(names.size === 4 && syntheticWrites.length === 4, "incomplete archive");
  // Simulate JSON serialization of a four-document atomic commit.
  const roundTrip=JSON.parse(JSON.stringify({writes:syntheticWrites}));
  for(const write of roundTrip.writes) {
    const original=archive.documents.find(d=>d.name === write.update.name);
    check(JSON.stringify(write.update.fields) === JSON.stringify(original.fields),
      "field loss during offline reconstruction");
  }
  volumes.sort((a,b)=>a.id.localeCompare(b.id));
  return {documentCount:4,wordCount:wordIds.size,volumes,
    simulatedWrites:roundTrip.writes.length,networkRequests:0,
    note:"Offline memory-only reconstruction. NOT a live restore test."};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    process.stderr.write("Usage: node tools/verify-firestore-backup.mjs /path/to/private.json\n");
    process.exitCode=2;
  } else {
    try {
      const report=inspectFirestoreArchive(JSON.parse(readFileSync(process.argv[2],"utf8")));
      process.stdout.write(JSON.stringify(report,null,2)+"\n");
    } catch(error) { process.stderr.write(error.message+"\n"); process.exitCode=1; }
  }
}
