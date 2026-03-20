import { MeetingParticipantDB, SessionDB } from "../models/model.js";
import { addJobToQueue } from "../services/queueService.js";

// Track meeting start times
const meetingStartTimes = new Map();

export function socketHandler(io) {
    io.on("connection", (socket) => {
        console.log("✅ Socket connected:", socket.id);
        console.log("📍 Origin:", socket.handshake.headers.origin);

        socket.on("join_meeting", async ({ meetingId, userId }) => {
            try {
                console.log(`\n🚪 JOIN: ${userId} → ${meetingId}`);
                socket.join(meetingId);

                // Initialize meeting start time if not exists
                if (!meetingStartTimes.has(meetingId)) {
                    meetingStartTimes.set(meetingId, Date.now());
                    console.log(`⏰ Meeting start time initialized for ${meetingId}`);
                }

                const startTime = Math.floor((Date.now() - meetingStartTimes.get(meetingId)) / 1000);

                // Find or create session document
                let sessionDoc = await SessionDB.findOne({ meetingId });
                if (!sessionDoc) {
                    console.log(`📝 Creating new session document for ${meetingId}`);
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

                // Create new session
                const sessionId = `${userId}_${sessionDoc.sessions[userId].length + 1}`;
                sessionDoc.sessions[userId].push({
                    sessionId,
                    start: startTime,
                    end: null
                });

                // Mark as modified for nested objects
                sessionDoc.markModified('sessions');
                await sessionDoc.save();
                console.log(`✅ Session saved: ${sessionId} at ${startTime}s`);

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

                socket.emit("joined_meeting", meetingId);
                console.log(`✅ JOIN COMPLETE\n`);

            } catch (err) {
                console.error("❌ Error in join_meeting:", err);
                console.error("Stack:", err.stack);
                socket.emit("join_error", "Unable to join meeting");
            }
        });

        socket.on("leave_meeting", async ({ meetingId, userId }) => {
            try {
                console.log(`\n👋 LEAVE: ${userId} ← ${meetingId}`);

                if (!meetingStartTimes.has(meetingId)) {
                    console.warn(`⚠️ No start time found for ${meetingId}`);
                    return;
                }

                const endTime = Math.floor((Date.now() - meetingStartTimes.get(meetingId)) / 1000);

                // Find session document and close active session
                const sessionDoc = await SessionDB.findOne({ meetingId });
                if (sessionDoc && sessionDoc.sessions[userId]) {
                    const activeSession = sessionDoc.sessions[userId].find(s => s.end === null);
                    if (activeSession) {
                        activeSession.end = endTime;
                        sessionDoc.markModified('sessions');
                        await sessionDoc.save();
                        console.log(`✅ Session closed: ${activeSession.sessionId} at ${endTime}s`);
                    } else {
                        console.warn(`⚠️ No active session found for ${userId}`);
                    }
                } else {
                    console.warn(`⚠️ No session document found for ${meetingId}`);
                }

                socket.leave(meetingId);
                console.log(`✅ LEAVE COMPLETE\n`);
            } catch (err) {
                console.error("❌ Error in leave_meeting:", err);
                console.error("Stack:", err.stack);
            }
        });

        socket.on("start_recording", (meetingId) => {
            console.log("start_recording from:", socket.id);
            io.to(meetingId).emit("start_recording");
        });

        socket.on("stop_recording", async (meetingId) => {
            console.log("stop_recording from:", socket.id);
            await addJobToQueue(meetingId);
            io.to(meetingId).emit("stop_recording");
        });

        socket.on("disconnect", async () => {
            console.log("socket disconnected:", socket.id);
            
            // Note: We can't reliably track which user disconnected without additional mapping
            // This is a limitation of the simplified approach
        });
    });
}

