// db.js
import { Dexie } from "dexie"

export const db = new Dexie("myDatabase")
db.version(4).stores({
  chunks: "++id, userId, meetingId, segmentIndex, chunkIndex" // segmentIndex groups chunks into 60s segments
});
