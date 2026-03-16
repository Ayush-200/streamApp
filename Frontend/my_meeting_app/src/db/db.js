// db.js
import { Dexie } from "dexie"

export const db = new Dexie("myDatabase")
db.version(3).stores({
  chunks: "++id, userId, meetingId, status, chunkIndex" // status: 0=pending, 1=uploaded
});
