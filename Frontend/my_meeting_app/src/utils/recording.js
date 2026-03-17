import { appendBlob } from './appendBlob.js';

let mediaRecorder = null;
let currentStream = null;
let isRecording = false;
let currentMeetingName = null;
let currentUserEmail = null;
let uploadInterval = null;
let chunkCounter = 0;
let segmentCounter = 0;
let isUploading = false;

export function isRecordingActive() {
  return isRecording && mediaRecorder && mediaRecorder.state === 'recording';
}

export function getCurrentMeetingName() {
  return currentMeetingName;
}

export async function startRecording(meetingName, userEmail = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.error("getUserMedia not supported!");
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
    chunkCounter = 0;
    segmentCounter = 0;

    startNewRecorder(); // Initial recorder setup

    // Start periodic segment finalization + upload
    startUploadInterval();

    console.log("Recording started.");
  } catch (err) {
    console.error("Error accessing camera/mic:", err);
    isRecording = false;
  }
}

function startNewRecorder() {
  if (!currentStream) return;

  mediaRecorder = new MediaRecorder(currentStream, {
    mimeType: "video/webm;codecs=vp9,opus", // or vp8 if vp9 causes issues
  });

  mediaRecorder.ondataavailable = async (e) => {
    if (e.data?.size > 0) {
      chunkCounter++;
      console.log(`Chunk ${chunkCounter} (segment ${segmentCounter}), size: ${e.data.size} bytes`);

      await appendBlob({
        userEmail: currentUserEmail, 
        meetingId: currentMeetingName,
        blob: e.data, 
        chunkIndex: chunkCounter,
        segmentIndex: segmentCounter
      });
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error("MediaRecorder error:", event.error);
  };

  mediaRecorder.start(2000);
  console.log(`✅ Started recording segment ${segmentCounter}`);
}

async function finalizeCurrentSegmentAndStartNew() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

  console.log("Finalizing current segment...");

  // 1. Request any pending data
  mediaRecorder.requestData();

  // 2. Stop the recorder → this will trigger final ondataavailable
  mediaRecorder.stop();

  // 3. Wait until the recorder is fully inactive (important!)
  await new Promise((resolve) => {
    const checkState = () => {
      if (mediaRecorder.state === 'inactive') {
        resolve();
      } else {
        setTimeout(checkState, 100);
      }
    };
    checkState();
  });

  console.log(`Segment ${segmentCounter} finalized`);

  // Move to next segment
  segmentCounter++;
  chunkCounter = 0;

  // Upload oldest segment in background (non-blocking)
  if (!isUploading) {
    uploadOldestSegment().catch(err => console.error("Background upload failed:", err));
  }

  // Start new recorder for seamless continuation
  if (currentStream && isRecording) {
    startNewRecorder();
  }
}

function startUploadInterval() {
  // Every 60 seconds → finalize segment + upload oldest
  uploadInterval = setInterval(() => {
    if (isRecordingActive()) {
      finalizeCurrentSegmentAndStartNew();
    }
  }, 60000);
}

async function uploadOldestSegment() {
  if (isUploading) {
    console.log("Upload already in progress, skipping...");
    return;
  }

  if (!navigator.onLine) {
    console.log("No internet connection – deferring upload");
    return;
  }

  isUploading = true;

  try {
    const { db } = await import('../db/db.js');

    const allChunks = await db.chunks
      .where('meetingId')
      .equals(currentMeetingName)
      .toArray();

    if (allChunks.length === 0) return;

    const oldestSegmentIndex = Math.min(...allChunks.map(c => c.segmentIndex));
    const segmentChunks = allChunks
      .filter(c => c.segmentIndex === oldestSegmentIndex)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (segmentChunks.length === 0) return;

    console.log(`Uploading segment ${oldestSegmentIndex} (${segmentChunks.length} chunks)`);

    const blobs = segmentChunks.map(c => c.blob);
    const mergedBlob = new Blob(blobs, { type: 'video/webm;codecs=vp9,opus' });

    const formData = new FormData();
    formData.append("file", mergedBlob, `segment-${oldestSegmentIndex}.webm`);
    formData.append("userId", currentUserEmail || "anonymous");
    formData.append("chunkIndex", oldestSegmentIndex); // or segmentIndex

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/uploadSegment/${currentMeetingName}`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    console.log(`Segment ${oldestSegmentIndex} uploaded OK`);

    // Clean up IndexedDB only after success
    for (const chunk of segmentChunks) {
      await db.chunks.delete(chunk.id);
    }

    console.log(`Deleted ${segmentChunks.length} chunks from IndexedDB`);

  } catch (err) {
    console.error("Segment upload failed:", err);
    // Optional: you could mark for retry later instead of losing it
  } finally {
    isUploading = false;
  }
}

export async function stopRecording() {
  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }

  if (isRecordingActive()) {
    // Finalize the very last segment
    await finalizeCurrentSegmentAndStartNew();
    // One more upload attempt for the last segment
    await uploadOldestSegment();
  }

  isRecording = false;
  mediaRecorder = null;

  console.log("Recording fully stopped.");
}

export function cleanupRecording() {
  stopRecording();

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}