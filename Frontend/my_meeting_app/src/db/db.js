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
// Version 6: Added compound unique index [meetingId+segmentIndex] to prevent duplicates
db.version(6).stores({
  chunks: "id, userId, meetingId, segmentIndex, [meetingId+segmentIndex], timestamp, retries, uploaded"
});

// Ensure database is opened
db.open().catch((err) => {
  console.error("Failed to open database:", err);
});