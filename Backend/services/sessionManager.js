import { SessionDB } from "../models/model.js";

// In-memory store for active sessions per meeting
const meetingSessions = new Map();

// Grace period for reopening recent sessions (2 seconds)
const SESSION_GRACE_PERIOD = 2;

// ─── Recording-driven session management ────────────────────────────

export function handleRecordingStarted(meetingId, userId) {
  const meeting = initializeMeeting(meetingId);

  if (!meeting.sessions[userId]) {
    meeting.sessions[userId] = [];
  }

  // Close any orphaned open sessions (e.g., user force-quit browser previously)
  const orphanedSessions = meeting.sessions[userId].filter(s => s.end === null);
  orphanedSessions.forEach(s => {
    s.end = getRelativeTimestamp(meetingId);
    console.log(`🔧 Closed orphaned session: ${s.sessionId} at ${s.end}s`);
  });

  const sessionId = generateSessionId(userId, meeting.sessions[userId].length);
  const newSession = {
    sessionId,
    userId,
    start: getRelativeTimestamp(meetingId),
    end: null,
    chunks: []
  };

  meeting.sessions[userId].push(newSession);
  console.log(`🔴 Session created: ${sessionId} at ${newSession.start}s (recording started)`);

  // Debug: dump full session state for this user
  console.log(`📊 [DEBUG] All sessions for ${userId}:`, JSON.stringify(meeting.sessions[userId], null, 2));
  console.log(`📊 [DEBUG] Full sessions object:`, JSON.stringify(meeting.sessions, null, 2));

  return newSession;
}

export function handleRecordingStopped(meetingId, userId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting || !meeting.sessions[userId]) {
    console.warn(`⚠️ No meeting/session data for stopping recording: ${userId}`);
    return null;
  }

  const activeSession = meeting.sessions[userId]
    .slice()
    .reverse()
    .find(s => s.end === null);

  if (!activeSession) {
    console.warn(`⚠️ No active recording session for ${userId} to stop`);
    return null;
  }

  activeSession.end = getRelativeTimestamp(meetingId);
  console.log(`⏹️ Session ended: ${activeSession.sessionId} at ${activeSession.end}s (recording stopped)`);

  // Debug: dump full session state for this user
  console.log(`📊 [DEBUG] All sessions for ${userId}:`, JSON.stringify(meeting.sessions[userId], null, 2));
  console.log(`📊 [DEBUG] Full sessions object:`, JSON.stringify(meeting.sessions, null, 2));

  return activeSession;
}

export function getUsersInMeeting(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) return [];
  return [...new Set(Object.values(meeting.userSocketMap))];
}

export function initializeMeeting(meetingId) {
  if (!meetingSessions.has(meetingId)) {
    meetingSessions.set(meetingId, {
      callStartTime: Date.now(),
      sessions: {},
      userSocketMap: {}
    });
    console.log(`✅ Initialized meeting: ${meetingId}`);
  }
  return meetingSessions.get(meetingId);
}

function getRelativeTimestamp(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) return 0;
  
  const relativeTime = (Date.now() - meeting.callStartTime) / 1000;
  return Math.round(relativeTime * 100) / 100;
}

function generateSessionId(userId, sessionCount) {
  return `${userId}_${sessionCount + 1}`;
}

export function recordChunkTiming(meetingId, userId, chunkIndex, chunkStartTime, chunkEndTime) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) {
    console.warn(`⚠️ No meeting found for chunk timing: ${meetingId}`);
    return;
  }

  if (!meeting.sessions[userId]) {
    meeting.sessions[userId] = [];
  }

  let session = meeting.sessions[userId].find(s => s.end === null);
  if (!session) {
    // No active session — don't create one. Session lifecycle is managed exclusively
    // by handleRecordingStarted/Stopped. This chunk will be attached if a session
    // is created shortly (race condition with socket event arriving after chunk upload).
    console.warn(`⚠️ No active session for chunk ${chunkIndex} from ${userId} — chunk not tracked in session`);
    return;
  }

  session.chunks = session.chunks || [];
  session.chunks.push({ chunkIndex, start: chunkStartTime, end: chunkEndTime });
}

export function handleUserJoined(meetingId, userId, socketId) {
  const meeting = initializeMeeting(meetingId);

  if (!meeting.sessions[userId]) {
    meeting.sessions[userId] = [];
  }

  const currentTime = getRelativeTimestamp(meetingId);

  // Update socket mapping
  meeting.userSocketMap[socketId] = userId;

  // Check for recent session within grace period to reopen it (brief reconnection)
  const recentSession = meeting.sessions[userId]
    .slice()
    .reverse()
    .find(s => s.end !== null && (currentTime - s.end) <= SESSION_GRACE_PERIOD);

  if (recentSession) {
    console.log(`🔄 Reopening session: ${recentSession.sessionId}`);
    recentSession.end = null;
    return recentSession;
  }

  // Don't create new sessions on join — sessions are recording-driven
  console.log(`👤 User ${userId} joined at ${currentTime}s`);
}

export function handleUserLeft(meetingId, userId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting || !meeting.sessions[userId]) {
    console.warn(`⚠️ No session data for ${userId} on leave`);
    return null;
  }

  const activeSession = meeting.sessions[userId]
    .slice()
    .reverse()
    .find(s => s.end === null);

  if (!activeSession) {
    console.log(`ℹ️ No active session for ${userId} on leave (recording was not active)`);
    return null;
  }

  const endTime = getRelativeTimestamp(meetingId);
  activeSession.end = endTime;

  console.log(`✅ ${userId} left at ${endTime}s (session duration: ${(endTime - activeSession.start).toFixed(2)}s)`);

  // Check if this was the last participant
  const hasActiveParticipants = Object.values(meeting.sessions).some(userSessions =>
    userSessions.some(session => session.end === null)
  );

  if (!hasActiveParticipants) {
    console.log(`🗑️ No active participants left in memory for: ${meetingId}`);
  }

  return activeSession;
}

export function handleUserDisconnect(meetingId, socketId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) return null;
  
  const userId = meeting.userSocketMap[socketId];
  if (!userId) return null;
  
  delete meeting.userSocketMap[socketId];
  return handleUserLeft(meetingId, userId);
}

export async function saveMeetingSessionsToDB(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) return null;

  Object.keys(meeting.sessions).forEach(userId => {
    const activeSession = meeting.sessions[userId].find(s => s.end === null);
    if (activeSession) {
      activeSession.end = getRelativeTimestamp(meetingId);
    }

    // Don't overwrite session.start/end with chunk timestamps — sessions are
    // recording-driven (start = record button, end = stop/leave) and use the
    // backend's consistent time base (relative to callStartTime).
    // Chunk times use a different time base (relative to frontend's meetingStartTime).
    meeting.sessions[userId].forEach(session => {
      delete session.chunks;
    });
  });

  console.log(`📊 [DEBUG] Saving to DB - sessions:`, JSON.stringify(meeting.sessions, null, 2));

  await SessionDB.findOneAndUpdate(
    { meetingId },
    {
      meetingId,
      callStartTime: new Date(meeting.callStartTime),
      sessions: meeting.sessions
    },
    { upsert: true }
  );

  console.log(`✅ Sessions saved to DB: ${meetingId}`);
  meetingSessions.delete(meetingId);
  return meeting.sessions;
}

export function getActiveMeetingIds() {
  return Array.from(meetingSessions.keys());
}
