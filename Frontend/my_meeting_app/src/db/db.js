// db.js
import { Dexie } from "dexie";

export const db = new Dexie("myDatabase");

// Global variable to store current meeting name
let currentMeetingName = null;

// Setter function to update meeting name
export function setMeetingName(meetingName) {
  currentMeetingName = meetingName;
  console.log("Meeting name set in db.js:", meetingName);
}

// Getter function to retrieve meeting name
export function getMeetingName() {
  return currentMeetingName;
}

// Store for meeting chunks
db.version(5).stores({
  chunks: "++id, userId, meetingId, segmentIndex, timestamp, retries, uploaded" // segmentIndex groups chunks into 60s segments
});

// Ensure database is opened
db.open().catch((err) => {
  console.error("Failed to open database:", err);
});