// db.js
import { Dexie } from "dexie";
import axios from "axios";
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

axios.post('/getMeetingId', {meetingName: currentMeetingName});


// Store for meeting chunks
db.version(5).stores({
  meetingName: "++id, userId, meetingId, segmentIndex, timestamp, retries, uploaded" // segmentIndex groups chunks into 60s segments
});