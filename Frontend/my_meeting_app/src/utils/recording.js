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

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    currentStream = stream;
    currentMeetingName = meetingName;
    currentUserEmail = userEmail;
    isRecording = true;
    segmentCounter = 0;

    startSegmentRecording(stream, meetingName, userEmail, segmentCounter);

    console.log("✅ Recording started.");
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
  console.log(`🎬 [STEP 1] Creating MediaRecorder with mimeType: ${mimeType}`);
  
  const recorder = new MediaRecorder(stream, { mimeType });

  let recordedChunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      console.log(`📊 [STEP 2] Chunk received - size: ${e.data.size}, type: ${e.data.type}`);
      recordedChunks.push(e.data);
    }
  };

  recorder.onstop = async () => {
    try {
      if (recordedChunks.length === 0) {
        console.warn(`⚠️ No data for segment ${segmentIndex}`);
        return;
      }

      console.log(`🔗 [STEP 3] Merging ${recordedChunks.length} chunks for segment ${segmentIndex}`);
      
      const segmentBlob = new Blob(recordedChunks, {
        type: mimeType
      });

      console.log(`📦 [STEP 4] Blob created:`);
      console.log(`   - Size: ${segmentBlob.size} bytes`);
      console.log(`   - Type: ${segmentBlob.type}`);
      console.log(`   - First 20 bytes:`, await segmentBlob.slice(0, 20).arrayBuffer());

      // Ensure database is ready
      if (!db.isOpen()) {
        console.log("⚠️ Database not open, opening now...");
        await db.open();
      } 

      // Save to IndexedDB
      await db.chunks.add({
        userId: userEmail,
        blob: segmentBlob,
        meetingId: meetingName,
        segmentIndex: segmentIndex,
        timestamp: Date.now(),
        retries: 0,
        uploaded: false
      });

      console.log(`✅ [STEP 5] Segment ${segmentIndex} saved to IndexedDB with type: ${segmentBlob.type}`);

      // Trigger upload (non-blocking)
      if (!isUploadInProgress()) {
        uploadOldestSegment(meetingName, userEmail);
      }

    } catch (error) {
      console.error("❌ Segment processing error:", error);
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

  console.log(`📹 Started segment ${segmentIndex}`);

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