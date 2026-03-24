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
// Version 5: Original schema with auto-increment primary key
db.version(5).stores({
  chunks: "++id, userId, meetingId, segmentIndex, timestamp, retries, uploaded"
});

// Version 6: Add compound index for preventing duplicates (keeps same primary key)
db.version(6).stores({
  chunks: "++id, userId, meetingId, segmentIndex, [meetingId+segmentIndex], timestamp, retries, uploaded"
});

// Ensure database is opened
db.open().catch(async (err) => {
  console.error("Failed to open database:", err);
  
  // If upgrade error, delete and recreate database
  if (err.name === 'UpgradeError') {
    console.warn("⚠️ Database upgrade error detected. Clearing database...");
    
    try {
      await db.delete();
      console.log("✅ Database deleted successfully");
      
      // Reopen with new schema
      await db.open();
      console.log("✅ Database recreated with new schema");
      
      alert("Database was upgraded. Any unsaved recordings have been cleared. Please restart your recording.");
    } catch (deleteErr) {
      console.error("❌ Failed to delete database:", deleteErr);
      alert("Database error. Please clear your browser data and refresh the page.");
    }
  }
});