import { MeetingParticipantDB } from "../models/model.js";

// In-memory store for active sessions per meeting
const meetingSessions = new Map();

export function initializeMeeting(meetingId) {
  console.log(`🔧 [INIT] Checking if meeting ${meetingId} is initialized...`);
  if (!meetingSessions.has(meetingId)) {
    meetingSessions.set(meetingId, {
      callStartTime: Date.now(),
      sessions: {},
      userSocketMap: {}
    });
    console.log(`✅ [INIT] Initialized session tracking for meeting: ${meetingId}`);
    console.log(`📅 [INIT] Call start time: ${new Date().toISOString()}`);
  } else {
    console.log(`ℹ️ [INIT] Meeting ${meetingId} already initialized`);
  }
  return meetingSessions.get(meetingId);
}

function getRelativeTimestamp(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) {
    console.warn(`⚠️ [TIMESTAMP] No meeting found for ${meetingId}, returning 0`);
    return 0;
  }
  const relativeTime = Math.floor((Date.now() - meeting.callStartTime) / 1000);
  console.log(`⏱️ [TIMESTAMP] Relative time for ${meetingId}: ${relativeTime}s`);
  return relativeTime;
}

function generateSessionId(userId, sessionCount) {
  const sessionId = `${userId}_${sessionCount + 1}`;
  console.log(`🆔 [SESSION_ID] Generated: ${sessionId}`);
  return sessionId;
}

export function handleUserJoined(meetingId, userId, socketId) {
  console.log(`\n🚪 [JOIN] ========== USER JOINING ==========`);
  console.log(`👤 [JOIN] User: ${userId}`);
  console.log(`🔌 [JOIN] Socket: ${socketId}`);
  console.log(`📍 [JOIN] Meeting: ${meetingId}`);
  
  const meeting = initializeMeeting(meetingId);
  
  if (!meeting.sessions[userId]) {
    console.log(`📝 [JOIN] Creating new session array for user ${userId}`);
    meeting.sessions[userId] = [];
  } else {
    console.log(`📝 [JOIN] User ${userId} has ${meeting.sessions[userId].length} existing session(s)`);
  }
  
  const activeSession = meeting.sessions[userId].find(s => s.end === null);
  if (activeSession) {
    console.warn(`⚠️ [JOIN] User ${userId} already has active session: ${activeSession.sessionId}`);
    activeSession.end = getRelativeTimestamp(meetingId);
    console.log(`🔒 [JOIN] Closed previous session at ${activeSession.end}s`);
  }
  
  const sessionId = generateSessionId(userId, meeting.sessions[userId].length);
  const startTime = getRelativeTimestamp(meetingId);
  const newSession = {
    sessionId,
    userId,
    start: startTime,
    end: null
  };
  
  meeting.sessions[userId].push(newSession);
  meeting.userSocketMap[socketId] = userId;
  
  console.log(`✅ [JOIN] Session created: ${sessionId} at ${startTime}s`);
  console.log(`🚪 [JOIN] ========== JOIN COMPLETE ==========\n`);
  
  return newSession;
}

export function handleUserLeft(meetingId, userId) {
  console.log(`\n👋 [LEAVE] ========== USER LEAVING ==========`);
  console.log(`👤 [LEAVE] User: ${userId}`);
  console.log(`📍 [LEAVE] Meeting: ${meetingId}`);
  
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) {
    console.error(`❌ [LEAVE] No meeting data found`);
    console.log(`👋 [LEAVE] ========== LEAVE FAILED ==========\n`);
    return null;
  }
  
  if (!meeting.sessions[userId]) {
    console.error(`❌ [LEAVE] No sessions found for user`);
    console.log(`👋 [LEAVE] ========== LEAVE FAILED ==========\n`);
    return null;
  }
  
  console.log(`📝 [LEAVE] User has ${meeting.sessions[userId].length} total session(s)`);
  
  const activeSession = meeting.sessions[userId]
    .slice()
    .reverse()
    .find(s => s.end === null);
  
  if (!activeSession) {
    console.error(`❌ [LEAVE] No active session found`);
    console.log(`👋 [LEAVE] ========== LEAVE FAILED ==========\n`);
    return null;
  }
  
  console.log(`🔍 [LEAVE] Found active session: ${activeSession.sessionId}`);
  
  const endTime = getRelativeTimestamp(meetingId);
  activeSession.end = endTime;
  const duration = endTime - activeSession.start;
  
  console.log(`🔒 [LEAVE] Session closed at: ${endTime}s`);
  console.log(`⏱️ [LEAVE] Duration: ${duration}s`);
  console.log(`✅ [LEAVE] User ${userId} left successfully`);
  console.log(`👋 [LEAVE] ========== LEAVE COMPLETE ==========\n`);
  
  return activeSession;
}

export function handleUserDisconnect(meetingId, socketId) {
  console.log(`\n🔌 [DISCONNECT] ========== DISCONNECT ==========`);
  console.log(`🔌 [DISCONNECT] Socket: ${socketId}`);
  console.log(`📍 [DISCONNECT] Meeting: ${meetingId}`);
  
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) {
    console.error(`❌ [DISCONNECT] No meeting data found`);
    console.log(`🔌 [DISCONNECT] ========== DISCONNECT FAILED ==========\n`);
    return null;
  }
  
  const userId = meeting.userSocketMap[socketId];
  if (!userId) {
    console.warn(`⚠️ [DISCONNECT] No userId for socket`);
    console.log(`🔌 [DISCONNECT] ========== DISCONNECT FAILED ==========\n`);
    return null;
  }
  
  console.log(`👤 [DISCONNECT] User: ${userId}`);
  delete meeting.userSocketMap[socketId];
  
  const result = handleUserLeft(meetingId, userId);
  console.log(`🔌 [DISCONNECT] ========== DISCONNECT COMPLETE ==========\n`);
  return result;
}

export function getMeetingSessions(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  return meeting ? JSON.parse(JSON.stringify(meeting.sessions)) : {};
}

export function getUserSessions(meetingId, userId) {
  const meeting = meetingSessions.get(meetingId);
  return (meeting && meeting.sessions[userId]) ? JSON.parse(JSON.stringify(meeting.sessions[userId])) : [];
}

export async function saveMeetingSessionsToDB(meetingId) {
  console.log(`\n💾 [SAVE] ========== SAVING TO DB ==========`);
  console.log(`📍 [SAVE] Meeting: ${meetingId}`);
  
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) {
    console.error(`❌ [SAVE] No session data found`);
    return null;
  }
  
  try {
    Object.keys(meeting.sessions).forEach(userId => {
      const activeSession = meeting.sessions[userId].find(s => s.end === null);
      if (activeSession) {
        activeSession.end = getRelativeTimestamp(meetingId);
        console.log(`🔒 [SAVE] Auto-closed session for ${userId}`);
      }
    });
    
    const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
    if (!meetingDoc) {
      console.error(`❌ [SAVE] Meeting not found in DB`);
      return null;
    }
    
    meetingDoc.sessionTimeline = meeting.sessions;
    meetingDoc.callStartTime = new Date(meeting.callStartTime);
    await meetingDoc.save();
    
    console.log(`✅ [SAVE] Saved successfully`);
    console.log(`💾 [SAVE] ========== SAVE COMPLETE ==========\n`);
    return meeting.sessions;
  } catch (error) {
    console.error(`❌ [SAVE] Error:`, error);
    return null;
  }
}

export function clearMeetingSessions(meetingId) {
  console.log(`🗑️ [CLEAR] Clearing session data for ${meetingId}`);
  return meetingSessions.delete(meetingId);
}

export function validateSessions(meetingId) {
  console.log(`\n✔️ [VALIDATE] ========== VALIDATING ==========`);
  const sessions = getMeetingSessions(meetingId);
  const errors = [];
  
  Object.entries(sessions).forEach(([userId, userSessions]) => {
    console.log(`👤 [VALIDATE] User: ${userId}, Sessions: ${userSessions.length}`);
    userSessions.forEach((session) => {
      if (session.start === undefined || session.start === null) {
        errors.push(`${session.sessionId}: missing start`);
      }
      if (session.end !== null && session.end < session.start) {
        errors.push(`${session.sessionId}: negative duration`);
      }
    });
    
    const activeSessions = userSessions.filter(s => s.end === null);
    if (activeSessions.length > 1) {
      errors.push(`${userId}: ${activeSessions.length} active sessions`);
    }
  });
  
  if (errors.length > 0) {
    console.error(`❌ [VALIDATE] Errors:`, errors);
    return { valid: false, errors };
  }
  
  console.log(`✅ [VALIDATE] All valid`);
  console.log(`✔️ [VALIDATE] ========== COMPLETE ==========\n`);
  return { valid: true, errors: [] };
}
