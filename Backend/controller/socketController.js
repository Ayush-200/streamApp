import { MeetingParticipantDB, SessionDB } from "../models/model.js";
import { addJobToQueue } from "../services/queueService.js";

// Track meeting start times
const meetingStartTimes = new Map();

// Track recording state per meeting
const meetingRecordingState = new Map();

export function socketHandler(io) {
    io.on("connection", (socket) => {
        console.log("✅ Socket connected:", socket.id);

        socket.on("join_meeting", async ({ meetingId, userId }) => {
            try {
                console.log(`🚪 User ${userId} joining ${meetingId}`);
                
                socket.join(meetingId);

                // Initialize meeting start time if not exists
                if (!meetingStartTimes.has(meetingId)) {
                    meetingStartTimes.set(meetingId, Date.now());
                }

                const currentTime = Math.round(((Date.now() - meetingStartTimes.get(meetingId)) / 1000) * 100) / 100;
                const GRACE_PERIOD = 2; // 2 seconds

                // Find or create session document
                let sessionDoc = await SessionDB.findOne({ meetingId });
                
                if (!sessionDoc) {
                    sessionDoc = await SessionDB.create({
                        meetingId,
                        callStartTime: new Date(meetingStartTimes.get(meetingId)),
                        sessions: {}
                    });
                }

                // Initialize user sessions array if not exists
                if (!sessionDoc.sessions[userId]) {
                    sessionDoc.sessions[userId] = [];
                }

                // Check for recent session within grace period
                const recentSession = sessionDoc.sessions[userId]
                    .slice()
                    .reverse()
                    .find(s => s.end !== null && (currentTime - s.end) <= GRACE_PERIOD);
                
                if (recentSession) {
                    console.log(`🔄 [JOIN] Reopening recent session: ${recentSession.sessionId} (closed ${(currentTime - recentSession.end).toFixed(2)}s ago)`);
                    recentSession.end = null;
                    sessionDoc.markModified('sessions');
                    await sessionDoc.save();
                } else {
                    // Create new session
                    const sessionId = `${userId}_${sessionDoc.sessions[userId].length + 1}`;
                    
                    sessionDoc.sessions[userId].push({
                        sessionId,
                        start: currentTime,
                        end: null
                    });

                    sessionDoc.markModified('sessions');
                    await sessionDoc.save();
                    console.log(`✅ [JOIN] New session created: ${sessionId} at ${currentTime}s`);
                }

                // Add participant to meeting
                const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
                if (!meetingDoc) {
                    await MeetingParticipantDB.create({
                        meetingId,
                        participantCount: 1,
                        participants: [{ userId, joinTime: new Date() }]
                    });
                } else {
                    const exists = meetingDoc.participants.some(p => p.userId === userId);
                    if (!exists) {
                        meetingDoc.participants.push({ userId, joinTime: new Date() });
                        meetingDoc.participantCount = meetingDoc.participants.length;
                        await meetingDoc.save();
                    }
                }

                // Check if recording is already in progress
                const isRecording = meetingRecordingState.get(meetingId) || false;

                socket.emit("joined_meeting", { meetingId, isRecording });
                console.log(`✅ ${userId} joined (recording: ${isRecording})`);

            } catch (err) {
                console.error("❌ Join error:", err.message);
                socket.emit("join_error", "Unable to join meeting");
            }
        });

        socket.on("leave_meeting", async ({ meetingId, userId, lastSegmentIndex }) => {
            try {
                console.log(`👋 User ${userId} leaving ${meetingId} (lastSegment: ${lastSegmentIndex})`);

                if (!meetingStartTimes.has(meetingId)) {
                    console.error(`❌ No start time found for ${meetingId}`);
                    return;
                }

                const endTime = Math.round(((Date.now() - meetingStartTimes.get(meetingId)) / 1000) * 100) / 100;

                // Find session document and close active session
                const sessionDoc = await SessionDB.findOne({ meetingId });
                
                if (!sessionDoc || !sessionDoc.sessions[userId]) {
                    console.error(`❌ No session found for ${userId} in ${meetingId}`);
                    return;
                }
                
                const activeSession = sessionDoc.sessions[userId].find(s => s.end === null);
                if (!activeSession) {
                    console.error(`❌ No active session for ${userId}`);
                    return;
                }
                
                activeSession.end = endTime;
                sessionDoc.markModified('sessions');
                await sessionDoc.save();

                // ✅ Update lastSegmentIndex in MeetingParticipant
                if (lastSegmentIndex !== undefined && lastSegmentIndex >= 0) {
                    const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
                    if (meetingDoc) {
                        const participant = meetingDoc.participants.find(p => p.userId === userId);
                        if (participant) {
                            participant.lastSegmentIndex = lastSegmentIndex;
                            participant.leaveTime = new Date();
                            await meetingDoc.save();
                            console.log(`✅ Updated lastSegmentIndex: ${lastSegmentIndex} for ${userId}`);
                        }
                    }
                }

                socket.leave(meetingId);
                console.log(`✅ ${userId} left (session closed at ${endTime}s)`);
            } catch (err) {
                console.error("❌ Leave error:", err.message);
            }
        });

        socket.on("start_recording", (meetingId) => {
            console.log(`🔴 Recording started for ${meetingId}`);
            
            meetingRecordingState.set(meetingId, true);
            io.to(meetingId).emit("start_recording");
        });

        socket.on("stop_recording", async (meetingId) => {
            console.log(`⏹️ Recording stopped for ${meetingId}`);
            
            meetingRecordingState.set(meetingId, false);
            await addJobToQueue(meetingId);
            io.to(meetingId).emit("stop_recording");
        });

        socket.on("disconnect", async () => {
            console.log("🔌 Socket disconnected:", socket.id);
            
            // Find which meeting this socket was in and close active sessions
            for (const [meetingId, startTime] of meetingStartTimes.entries()) {
                const sessionDoc = await SessionDB.findOne({ meetingId });
                
                if (!sessionDoc) continue;
                
                // Find user by checking all sessions
                let disconnectedUserId = null;
                for (const [userId, sessions] of Object.entries(sessionDoc.sessions)) {
                    const activeSession = sessions.find(s => s.end === null);
                    if (activeSession) {
                        // Check if this user might be the disconnected socket
                        // We'll close all active sessions on disconnect
                        const endTime = Math.round(((Date.now() - startTime) / 1000) * 100) / 100;
                        activeSession.end = endTime;
                        disconnectedUserId = userId;
                        console.log(`🔒 [DISCONNECT] Closed session for ${userId} at ${endTime}s`);
                    }
                }
                
                if (disconnectedUserId) {
                    sessionDoc.markModified('sessions');
                    await sessionDoc.save();
                    console.log(`✅ [DISCONNECT] Saved session closure for ${disconnectedUserId}`);
                }
            }
        });
    });
}
