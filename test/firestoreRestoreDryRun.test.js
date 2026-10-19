import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { inspectFirestoreArchive } from "../tools/verify-firestore-backup.mjs";
const prefix="projects/svl-app-65204/databases/(default)/documents/privateWords/";
const header="id,word,meaning,morpheme,morphemeMeaning,semanticDevelopment,partOfSpeech,semanticCategory,phonetic,pronunciationAudioUrl,pronunciationSource,pronunciationStatus";
function fixture() {
 const documents=["vol1","vol2","vol3","vol4"].map((v,i)=>{
   const csv=header+"\n"+"w_"+i+",hello,world,,,,,,,,,";
   const compressed=i>=2;
   const stored=compressed?gzipSync(Buffer.from(csv)).toString("base64"):csv;
   return {name:prefix+v,createTime:"2026-05-16T00:00:00Z",
     updateTime:"2026-10-08T00:00:00Z",fields:{
     csvEncoding:{stringValue:compressed?"gzip-base64":"plain"},
     uncompressedBytes:{integerValue:String(Buffer.byteLength(csv))},
     storedBytes:{integerValue:String(Buffer.byteLength(stored))},
     syncedAt:{timestampValue:"2026-10-08T12:44:05.509Z"},
     updatedAt:{timestampValue:"2026-09-14T00:00:00Z"},
     ...(compressed?{csvGzipBase64:{stringValue:stored}}:{csv:{stringValue:stored}})
   }};
 });
 return {schemaVersion:1,firebaseProjectId:"svl-app-65204",
   collectionName:"privateWords",documentCount:4,documents};
}
const src=fixture(), report=inspectFirestoreArchive(src);
assert.equal(report.wordCount,4);
assert.equal(report.simulatedWrites,4);
assert.equal(report.networkRequests,0);
assert.equal(report.volumes[2].encoding,"gzip-base64");
assert.ok(report.volumes.every(v=>v.fieldNames.includes("updatedAt")));
function mustReject(change) {
 const copy=structuredClone(src);
 change(copy);
 assert.throws(()=>inspectFirestoreArchive(copy),/Backup invalid/);
}
mustReject(a=>a.firebaseProjectId="wrong");
mustReject(a=>a.collectionName="privateUsers");
mustReject(a=>a.documentCount=3);
mustReject(a=>a.documents[1].name=a.documents[0].name);
mustReject(a=>a.documents[0].fields.csv.stringValue="truncated");
mustReject(a=>a.documents[2].fields.csvGzipBase64.stringValue="!bad!");
mustReject(a=>a.documents[1].fields.storedBytes.integerValue="1");
mustReject(a=>a.documents[1].fields.csvGzipBase64={stringValue:"AA=="});
mustReject(a=>a.documents[2].fields.csv={stringValue:"unexpected"});
console.log("Offline Firestore restore reconstruction tests passed (zero HTTP writes).");
