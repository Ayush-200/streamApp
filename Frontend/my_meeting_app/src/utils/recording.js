import { db } from '../db/db.js';
import { uploadOldestSegment, isUploadInProgress } from './uploadSegment.js';

let mediaRecorder;
let currentStream = null;
let isRecording = false;
let currentMeetingName = null;
let currentUserEmail = null;
let segmentCounter = 0;
let stopTimeout = null;

export function isRecordingActive() {
  return isRecording && mediaRecorder && mediaRecorder.state === 'recording';
}

export function getCurrentMeetingName() {
  return currentMeetingName;
}

export async function startRecording(meetingName, userEmail = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.log("❌ getUserMedia not supported!");
    return;
  }

  // ✅ Prevent multiple simultaneous recordings
  if (isRecording) {
    console.warn("⚠️ Recording already in progress, ignoring duplicate call");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    currentStream = stream;
    currentMeetingName = meetingName;
    currentUserEmail = userEmail;
    isRecording = true;
    
    // ✅ Multi-layer check for segment counter to prevent overwriting
    // Priority: localStorage → Database → IndexedDB → Start at 0
    
    let maxSegmentIndex = -1;
    const storageKey = `lastSegment_${meetingName}_${userEmail}`;
    
    // 1. Check localStorage (fastest, browser-specific)
    const localStorageIndex = localStorage.getItem(storageKey);
    if (localStorageIndex !== null) {
      maxSegmentIndex = parseInt(localStorageIndex, 10);
      console.log(`📊 Found lastSegmentIndex in localStorage: ${maxSegmentIndex}`);
    } else {
      console.log(`📊 No localStorage entry, checking database...`);
      
      // 2. Check database (source of truth, cross-device)
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/getLastSegmentIndex/${encodeURIComponent(meetingName)}/${encodeURIComponent(userEmail)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.lastSegmentIndex !== undefined && data.lastSegmentIndex >= 0) {
            maxSegmentIndex = data.lastSegmentIndex;
            console.log(`📊 Found lastSegmentIndex in database: ${maxSegmentIndex}`);
            
            // Sync to localStorage
            localStorage.setItem(storageKey, maxSegmentIndex.toString());
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch lastSegmentIndex from database:`, error.message);
      }
    }
    
    // 3. Check IndexedDB for any unsaved segments (fallback)
    const existingSegments = await db.chunks
      .where('meetingId')
      .equals(meetingName)
      .toArray();
    
    if (existingSegments.length > 0) {
      const indexedDBMax = Math.max(...existingSegments.map(s => s.segmentIndex));
      if (indexedDBMax > maxSegmentIndex) {
        maxSegmentIndex = indexedDBMax;
        console.log(`📊 Found higher index in IndexedDB: ${maxSegmentIndex}`);
      }
    }
    
    // Set counter to next available index
    segmentCounter = maxSegmentIndex + 1;
    console.log(`📊 Starting recording from segment ${segmentCounter}`);

    startSegmentRecording(stream, meetingName, userEmail, segmentCounter);

    console.log("✅ Recording started");
  } catch (err) {
    console.error("❌ Error accessing camera/mic:", err);
    isRecording = false;
  }
}

function getSupportedMimeType() {
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
    return "video/webm;codecs=vp9,opus";
  }
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
    return "video/webm;codecs=vp8,opus";
  }
  return "video/webm";
}

function startSegmentRecording(stream, meetingName, userEmail, segmentIndex) {
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });

  let recordedChunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  recorder.onstop = async () => {
    try {
      if (recordedChunks.length === 0) {
        console.warn(`⚠️ No data for segment ${segmentIndex}`);
        return;
      }

      const segmentBlob = new Blob(recordedChunks, { type: mimeType });
      console.log(`💾 Saving segment ${segmentIndex} (${(segmentBlob.size / 1024 / 1024).toFixed(2)}MB)`);

      // Ensure database is ready
      if (!db.isOpen()) {
        await db.open();
      } 

      // Create unique composite key to prevent duplicates
      const uniqueId = `${meetingName}_${segmentIndex}`;

      await db.chunks.put({
        id: uniqueId,
        userId: userEmail,
        blob: segmentBlob,
        meetingId: meetingName,
        segmentIndex: segmentIndex,
        timestamp: Date.now(),
        retries: 0,
        uploaded: false
      });

      // ✅ Update localStorage with latest segment index
      const storageKey = `lastSegment_${meetingName}_${userEmail}`;
      localStorage.setItem(storageKey, segmentIndex.toString());

      // Trigger upload (non-blocking)
      if (!isUploadInProgress()) {
        uploadOldestSegment(meetingName, userEmail);
      }

    } catch (error) {
      console.error("❌ Segment save error:", error);
    }

    // Start next segment
    if (isRecording && currentStream) {
      segmentCounter++;
      startSegmentRecording(currentStream, meetingName, userEmail, segmentCounter);
    }
  };

  recorder.onerror = (event) => {
    console.error("❌ MediaRecorder error:", event.error);
  };

  recorder.start();
  mediaRecorder = recorder;

  // Stop after 60 seconds
  stopTimeout = setTimeout(() => {
    if (recorder.state === "recording") {
      recorder.stop();
    }
  }, 60000);
}

export function stopRecording() {
  isRecording = false;

  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }

  console.log("🛑 Recording stopped.");
}

export function cleanupRecording() {
  stopRecording();

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

// Save current recording blob immediately and return a promise
export async function saveCurrentBlobAndStop() {
  return new Promise((resolve, reject) => {
    try {
      if (!isRecording || !mediaRecorder) {
        resolve();
        return;
      }

      console.log("💾 Saving current recording...");
      
      isRecording = false;

      if (stopTimeout) {
        clearTimeout(stopTimeout);
        stopTimeout = null;
      }

      if (mediaRecorder.state === "recording") {
        mediaRecorder.addEventListener('stop', () => {
          console.log("✅ Recording saved");
          
          if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
          }
          
          resolve();
        }, { once: true });

        mediaRecorder.stop();
      } else {
        if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
          currentStream = null;
        }
        resolve();
      }
    } catch (error) {
      console.error("❌ Save error:", error);
      reject(error);
    }
  });
}