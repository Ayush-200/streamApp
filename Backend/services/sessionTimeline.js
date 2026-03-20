import { MeetingParticipantDB } from "../models/model.js";

// In-memory store for active sessions per meeting
// Structure: { meetingId: { callStartTime: timestamp, sessions: { userId: [sessions] } } }
const meetingSessions = new Map();

/**
 * Initialize a meeting's session tracking
 */
export function initializeMeeting(meetingId) {
  if (!meetingSessions.has(meetingId)) {
    meetingSessions.set(meetingId, {
      callStartTime: Date.now(),
      sessions: {},
      userSocketMap: {} // Track userId to socketId mapping
    });
    console.log(`📊 Initialized session tracking for meeting: ${meetingId}`);
  }
  return meetingSessions.get(meetingId);
}

/**
 * Get relative timestamp (seconds since call start)
 */
function getRelativeTimestamp(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) return 0;
  return Math.floor((Date.now() - meeting.callStartTime) / 1000);
}

/**
 * Generate unique session ID
 */
function generateSessionId(userId, sessionCount) {
  return `${userId}_${sessionCount + 1}`;
}

/**
 * Handle user joined event
 */
export function handleUserJoined(meetingId, userId, socketId) {
  const meeting = initializeMeeting(meetingId);
  
  // Initialize user's session array if not exists
  if (!meeting.sessions[userId]) {
    meeting.sessions[userId] = [];
  }
  
  // Check if user already has an active session (shouldn't happen, but safety check)
  const activeSession = meeting.sessions[userId].find(s => s.end === null);
  if (activeSession) {
    console.warn(`⚠️ User ${userId} already has an active session. Closing it first.`);
    activeSession.end = getRelativeTimestamp(meetingId);
  }
  
  // Create new session
  const sessionId = generateSessionId(userId, meeting.sessions[userId].length);
  const newSession = {
    sessionId,
    userId,
    start: getRelativeTimestamp(meetingId),
    end: null
  };
  
  meeting.sessions[userId].push(newSession);
  meeting.userSocketMap[socketId] = userId;
  
  console.log(`✅ User ${userId} joined at ${newSession.start}s - Session: ${sessionId}`);
  
  return newSession;
}

/**
 * Handle user left event
 */
export function handleUserLeft(meetingId, userId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting || !meeting.sessions[userId]) {
    console.warn(`⚠️ No session found for user ${userId} in meeting ${meetingId}`);
    return null;
  }
  
  // Find the latest active session (where end === null)
  const activeSession = meeting.sessions[userId]
    .slice()
    .reverse()
    .find(s => s.end === null);
  
  if (!activeSession) {
    console.warn(`⚠️ No active session found for user ${userId}`);
    return null;
  }
  
  // Close the session
  activeSession.end = getRelativeTimestamp(meetingId);
  
  console.log(`👋 User ${userId} left at ${activeSession.end}s - Session: ${activeSession.sessionId} (duration: ${activeSession.end - activeSession.start}s)`);
  
  return activeSession;
}

/**
 * Handle unexpected disconnect
 */
export function handleUserDisconnect(meetingId, socketId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) return null;
  
  const userId = meeting.userSocketMap[socketId];
  if (!userId) {
    console.warn(`⚠️ No userId found for socket ${socketId}`);
    return null;
  }
  
  console.log(`🔌 Socket ${socketId} disconnected unexpectedly for user ${userId}`);
  
  // Clean up socket mapping
  delete meeting.userSocketMap[socketId];
  
  // Treat as user_left
  return handleUserLeft(meetingId, userId);
}

/**
 * Get all sessions for a meeting
 */
export function getMeetingSessions(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) {
    return {};
  }
  
  // Return a deep copy to prevent external modifications
  return JSON.parse(JSON.stringify(meeting.sessions));
}

/**
 * Get sessions for a specific user
 */
export function getUserSessions(meetingId, userId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting || !meeting.sessions[userId]) {
    return [];
  }
  
  return JSON.parse(JSON.stringify(meeting.sessions[userId]));
}

/**
 * Save sessions to database
 */
export async function saveMeetingSessionsToDB(meetingId) {
  const meeting = meetingSessions.get(meetingId);
  if (!meeting) {
    console.warn(`⚠️ No session data found for meeting ${meetingId}`);
    return null;
  }
  
  try {
    // Close any open sessions before saving
    Object.keys(meeting.sessions).forEach(userId => {
      const activeSession = meeting.sessions[userId].find(s => s.end === null);
      if (activeSession) {
        activeSession.end = getRelativeTimestamp(meetingId);
        console.log(`🔒 Auto-closing session for user ${userId} at ${activeSession.end}s`);
      }
    });
    
    const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
    if (!meetingDoc) {
      console.error(`❌ Meeting ${meetingId} not found in database`);
      return null;
    }
    
    // Add session timeline to meeting document
    meetingDoc.sessionTimeline = meeting.sessions;
    meetingDoc.callStartTime = new Date(meeting.callStartTime);
    await meetingDoc.save();
    
    console.log(`💾 Saved session timeline for meeting ${meetingId}`);
    console.log(JSON.stringify(meeting.sessions, null, 2));
    
    return meeting.sessions;
  } catch (error) {
    console.error(`❌ Error saving sessions for meeting ${meetingId}:`, error);
    return null;
  }
}

/**
 * Clear meeting sessions from memory (call after saving to DB)
 */
export function clearMeetingSessions(meetingId) {
  const deleted = meetingSessions.delete(meetingId);
  if (deleted) {
    console.log(`🗑️ Cleared session data for meeting ${meetingId}`);
  }
  return deleted;
}

/**
 * Validate sessions (for debugging)
 */
export function validateSessions(meetingId) {
  const sessions = getMeetingSessions(meetingId);
  const errors = [];
  
  Object.entries(sessions).forEach(([userId, userSessions]) => {
    userSessions.forEach((session, index) => {
      // Check for missing start
      if (session.start === undefined || session.start === null) {
        errors.push(`Session ${session.sessionId} has missing start`);
      }
      
      // Check for overlapping sessions
      for (let i = index + 1; i < userSessions.length; i++) {
        const nextSession = userSessions[i];
        if (session.end !== null && nextSession.start < session.end) {
          errors.push(`Sessions ${session.sessionId} and ${nextSession.sessionId} overlap`);
        }
      }
      
      // Check for negative duration
      if (session.end !== null && session.end < session.start) {
        errors.push(`Session ${session.sessionId} has negative duration`);
      }
    });
    
    // Check for multiple active sessions
    const activeSessions = userSessions.filter(s => s.end === null);
    if (activeSessions.length > 1) {
      errors.push(`User ${userId} has ${activeSessions.length} active sessions`);
    }
  });
  
  if (errors.length > 0) {
    console.error(`❌ Session validation errors for meeting ${meetingId}:`, errors);
    return { valid: false, errors };
  }
  
  console.log(`✅ Session validation passed for meeting ${meetingId}`);
  return { valid: true, errors: [] };
}
