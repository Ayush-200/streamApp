import { appendBlob } from './appendBlob.js';

let mediaRecorder;
let currentStream = null;
let isRecording = false;
let currentMeetingName = null;
let currentUserEmail = null;
let uploadInterval = null;
let segmentCounter = 0;
let isUploading = false;

// 🔹 store chunks for current segment
let segmentChunks = [];

export function isRecordingActive() {
  return isRecording && mediaRecorder && mediaRecorder.state === 'recording';
}

export async function startRecording(meetingName, userEmail = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.log("getUserMedia not supported!");
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

    startNewSegment();

    // 🔹 start interval to rotate segments
    startUploadInterval();

    console.log("Recording started.");
  } catch (err) {
    console.error("Error accessing camera/mic:", err);
    isRecording = false;
  }
}

// 🔥 Start a fresh MediaRecorder (new segment)
function startNewSegment() {
  segmentChunks = [];

  mediaRecorder = new MediaRecorder(currentStream, {
    mimeType: "video/webm;codecs=vp9,opus",
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      segmentChunks.push(e.data);
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error("MediaRecorder error:", event.error);
  };

  mediaRecorder.onstop = async () => {
    console.log(`🧩 Finalizing segment ${segmentCounter}`);

    if (segmentChunks.length === 0) return;

    const finalBlob = new Blob(segmentChunks, { type: "video/webm" });

    console.log(`📦 Segment ${segmentCounter} size: ${finalBlob.size}`);

    // store in IndexedDB
    await appendBlob({
      userEmail: currentUserEmail,
      meetingId: currentMeetingName,
      blob: finalBlob,
      chunkIndex: segmentCounter,
      segmentIndex: segmentCounter,
    });

    // upload in background
    if (!isUploading) {
      uploadOldestSegment(currentMeetingName, currentUserEmail);
    }
  };

  mediaRecorder.start(); // 🔥 IMPORTANT: no 2s slicing
}

// 🔁 Rotate segments every 60s
function startUploadInterval() {
  uploadInterval = setInterval(async () => {
    console.log("⏰ 60s reached → rotating segment");

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop(); // 🔥 finalize segment

      // wait for onstop to finish
      await new Promise((r) => setTimeout(r, 1000));

      segmentCounter++;

      if (currentStream && isRecording) {
        startNewSegment(); // 🔥 start fresh recorder
      }
    }
  }, 60000);
}

// 📤 Upload oldest segment from IndexedDB
async function uploadOldestSegment(meetingId, userEmail) {
  if (isUploading) return;
  if (!navigator.onLine) return;

  isUploading = true;

  try {
    const { db } = await import('../db/db.js');

    const allSegments = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .toArray();

    if (allSegments.length === 0) {
      console.log("✅ No segments to upload");
      return;
    }

    const oldestSegment = allSegments[0];

    console.log(`📤 Uploading segment ${oldestSegment.segmentIndex}`);

    const formData = new FormData();
    formData.append(
      "file",
      oldestSegment.blob,
      `segment-${oldestSegment.segmentIndex}.webm`
    );
    formData.append("userId", userEmail);
    formData.append("chunkIndex", oldestSegment.segmentIndex);

    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/uploadSegment/${meetingId}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    console.log(`✅ Segment ${oldestSegment.segmentIndex} uploaded`);

    // delete after upload
    await db.chunks.delete(oldestSegment.id);

  } catch (err) {
    console.error("❌ Upload error:", err);
  } finally {
    isUploading = false;
  }
}

export function stopRecording() {
  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  isRecording = false;
}

export function cleanupRecording() {
  stopRecording();

  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
}