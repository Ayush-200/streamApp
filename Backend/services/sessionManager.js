import { SessionDB } from "../models/model.js";

// In-memory store for active sessions per meeting
const meetingSessions = new Map();

// Grace period for reopening recent sessions (2 seconds)
const SESSION_GRACE_PERIOD = 2;

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

export function handleUserJoined(meetingId, userId, socketId) {
  const meeting = initializeMeeting(meetingId);
  
  if (!meeting.sessions[userId]) {
    meeting.sessions[userId] = [];
  }
  
  const currentTime = getRelativeTimestamp(meetingId);
  
  // Check for recent session within grace period (2 seconds)
  const recentSession = meeting.sessions[userId]
    .slice()
    .reverse()
    .find(s => s.end !== null && (currentTime - s.end) <= SESSION_GRACE_PERIOD);
  
  if (recentSession) {
    console.log(`🔄 Reopening session: ${recentSession.sessionId}`);
    recentSession.end = null;
    meeting.userSocketMap[socketId] = userId;
    return recentSession;
  }
  
  // Close any active session
  const activeSession = meeting.sessions[userId].find(s => s.end === null);
  if (activeSession) {
    activeSession.end = currentTime;
  }
  
  const sessionId = generateSessionId(userId, meeting.sessions[userId].length);
  const newSession = {
    sessionId,
    userId,
    start: currentTime,
    end: null
  };
  
  meeting.sessions[userId].push(newSession);
  meeting.userSocketMap[socketId] = userId;
  
  console.log(`✅ Session created: ${sessionId} at ${currentTime}s`);
  return newSession;
}

export function handleUserLeft(meetingId, userId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting || !meeting.sessions[userId]) {
    console.error(`❌ No session found for ${userId}`);
    return null;
  }
  
  const activeSession = meeting.sessions[userId]
    .slice()
    .reverse()
    .find(s => s.end === null);
  
  if (!activeSession) {
    console.error(`❌ No active session for ${userId}`);
    return null;
  }
  
  const endTime = getRelativeTimestamp(meetingId);
  activeSession.end = endTime;
  
  console.log(`✅ ${userId} left at ${endTime}s (duration: ${(endTime - activeSession.start).toFixed(2)}s)`);
  
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
  });

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
