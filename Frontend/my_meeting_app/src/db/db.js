// db.js
import { Dexie } from "dexie"

export const db = new Dexie("myDatabase")
db.version(2).stores({
  chunks: "++id, userId, meetingId, uploaded, chunkIndex" // Primary key and indexed props
});
