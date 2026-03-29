import dotenv from "dotenv";
import { MeetingParticipantDB, SessionDB } from "../models/model.js";
dotenv.config();

// Round timestamp to 2 decimals
function roundTimestamp(timestamp) {
  return Math.round(timestamp * 100) / 100;
}

// Filter out segments shorter than 0.1 seconds
function filterShortSegments(sessions) {
  const filtered = {};
  for (const [userId, userSessions] of Object.entries(sessions)) {
    filtered[userId] = userSessions.filter(session => {
      const duration = session.end - session.start;
      if (duration < 0.1) {
        console.log(`⚠️ [FILTER] Removing short segment: ${session.sessionId} (${duration.toFixed(3)}s)`);
        return false;
      }
      return true;
    });
  }
  return filtered;
}

// Validate video files exist and are accessible
async function validateVideoFiles(videoUrls) {
  const validationResults = await Promise.all(
    videoUrls.map(async (url, index) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          console.error(`❌ [VALIDATE] Video ${index + 1} not accessible: ${response.status}`);
          return false;
        }
        console.log(`✅ [VALIDATE] Video ${index + 1} validated`);
        return true;
      } catch (error) {
        console.error(`❌ [VALIDATE] Video ${index + 1} validation failed:`, error.message);
        return false;
      }
    })
  );
  
  return validationResults.every(result => result === true);
}

export async function mergeAndDownloadVideo(meetingId) {
  console.log("inside merge and download");
  const participantsDoc = await MeetingParticipantDB.findOne({ meetingId }).lean();
  const video1 = participantsDoc.participants[0]?.videoPublicId;
  const video2 = participantsDoc.participants[1]?.videoPublicId;

  if(!video1 || !video2) throw new Error("Missing participant videos");
  
  // Validate video files before processing
  const videoUrls = [video1, video2];
  const isValid = await validateVideoFiles(videoUrls);
  if (!isValid) {
    throw new Error("Video validation failed - one or more videos are not accessible");
  }

  // Get session timeline data
  const sessionDoc = await SessionDB.findOne({ meetingId }).lean();
  let sessions = sessionDoc?.sessions || {};
  
  // Filter out short segments
  sessions = filterShortSegments(sessions);
  
  // Round all timestamps to 2 decimals
  const roundedSessions = {};
  for (const [userId, userSessions] of Object.entries(sessions)) {
    roundedSessions[userId] = userSessions.map(session => ({
      ...session,
      start: roundTimestamp(session.start),
      end: session.end !== null ? roundTimestamp(session.end) : null
    }));
  }

  const fetchAndMerge = await fetch(`${process.env.FFMPEG_WORKER_URL}/stitch`,{ 
    method: "POST", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      videoUrls,
      sessions: roundedSessions,
      options: {
        useAudioMixing: true,
        reEncode: true,
        avSync: true,
        minSegmentDuration: 0.1
      }
    })
  })

  if(!fetchAndMerge.ok){
    console.error("FFMPEG Worker error:", await fetchAndMerge.text()); 
    throw new Error("FFmpeg processing failed");
  }

  return await fetchAndMerge.json();
}

