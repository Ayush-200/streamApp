// db.js
import { Dexie } from "dexie"

export const db = new Dexie("myDatabase")
db.version(1).stores({
  chunks: "++id, userId, blob, meetingId", // Primary key and indexed props
})
