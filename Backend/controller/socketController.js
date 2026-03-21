import { MeetingParticipantDB, SessionDB } from "../models/model.js";
import { addJobToQueue } from "../services/queueService.js";

// Track meeting start times
const meetingStartTimes = new Map();

// Track recording state per meeting
const meetingRecordingState = new Map();

export function socketHandler(io) {
    io.on("connection", (socket) => {
        console.log("✅ Socket connected:", socket.id);
        console.log("📍 Origin:", socket.handshake.headers.origin);

        socket.on("join_meeting", async ({ meetingId, userId }) => {
            try {
                console.log(`\n🚪 ========== JOIN_MEETING ==========`);
                console.log(`� User: ${userId}`);
                console.log(`�📍 Meeting: ${meetingId}`);
                console.log(`🔌 Socket: ${socket.id}`);
                
                socket.join(meetingId);

                // Initialize meeting start time if not exists
                if (!meetingStartTimes.has(meetingId)) {
                    meetingStartTimes.set(meetingId, Date.now());
                    console.log(`⏰ Meeting start time initialized for ${meetingId}`);
                } else {
                    console.log(`⏰ Meeting start time already exists for ${meetingId}`);
                }

                const startTime = Math.floor((Date.now() - meetingStartTimes.get(meetingId)) / 1000);
                console.log(`⏱️ Start time: ${startTime}s`);

                // Find or create session document
                console.log(`🔍 Looking for existing session document...`);
                let sessionDoc = await SessionDB.findOne({ meetingId });
                
                if (!sessionDoc) {
                    console.log(`📝 No existing document found. Creating new session document for ${meetingId}`);
                    try {
                        sessionDoc = await SessionDB.create({
                            meetingId,
                            callStartTime: new Date(meetingStartTimes.get(meetingId)),
                            sessions: {}
                        });
                        console.log(`✅ New session document created with ID: ${sessionDoc._id}`);
                    } catch (createError) {
                        console.error(`❌ Error creating session document:`, createError);
                        throw createError;
                    }
                } else {
                    console.log(`✅ Found existing session document with ID: ${sessionDoc._id}`);
                    console.log(`📊 Current users in document:`, Object.keys(sessionDoc.sessions));
                }

                // Initialize user sessions array if not exists
                if (!sessionDoc.sessions[userId]) {
                    console.log(`📝 Creating new sessions array for user ${userId}`);
                    sessionDoc.sessions[userId] = [];
                } else {
                    console.log(`✅ User ${userId} already has ${sessionDoc.sessions[userId].length} session(s)`);
                }

                // Create new session
                const sessionId = `${userId}_${sessionDoc.sessions[userId].length + 1}`;
                console.log(`🆔 Generated session ID: ${sessionId}`);
                
                sessionDoc.sessions[userId].push({
                    sessionId,
                    start: startTime,
                    end: null
                });

                // Mark as modified for nested objects
                sessionDoc.markModified('sessions');
                console.log(`💾 Saving session document...`);
                
                try {
                    await sessionDoc.save();
                    console.log(`✅ Session saved successfully!`);
                    console.log(`📊 Total users in document: ${Object.keys(sessionDoc.sessions).length}`);
                } catch (saveError) {
                    console.error(`❌ Error saving session document:`, saveError);
                    throw saveError;
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

                // Check if recording is already in progress for this meeting
                const isRecording = meetingRecordingState.get(meetingId) || false;
                console.log(`🎥 Recording state for ${meetingId}: ${isRecording}`);

                socket.emit("joined_meeting", { meetingId, isRecording });
                console.log(`✅ JOIN COMPLETE (recording: ${isRecording})\n`);

            } catch (err) {
                console.error("❌ ========== ERROR IN JOIN_MEETING ==========");
                console.error("Error:", err.message);
                console.error("Stack:", err.stack);
                console.error("Meeting ID:", meetingId);
                console.error("User ID:", userId);
                socket.emit("join_error", "Unable to join meeting");
            }
        });

        socket.on("leave_meeting", async ({ meetingId, userId }) => {
            try {
                console.log(`\n👋 ========== LEAVE_MEETING EVENT RECEIVED ==========`);
                console.log(`👤 User: ${userId}`);
                console.log(`📍 Meeting: ${meetingId}`);
                console.log(`🔌 Socket: ${socket.id}`);

                if (!meetingStartTimes.has(meetingId)) {
                    console.error(`❌ No start time found for ${meetingId}`);
                    console.log(`🗺️ Available meetings:`, Array.from(meetingStartTimes.keys()));
                    return;
                }

                const endTime = Math.floor((Date.now() - meetingStartTimes.get(meetingId)) / 1000);
                console.log(`⏱️ End time calculated: ${endTime}s`);

                // Find session document and close active session
                console.log(`🔍 Looking for session document...`);
                const sessionDoc = await SessionDB.findOne({ meetingId });
                
                if (!sessionDoc) {
                    console.error(`❌ No session document found for ${meetingId}`);
                    return;
                }
                
                console.log(`✅ Session document found`);
                console.log(`📊 Current sessions:`, JSON.stringify(sessionDoc.sessions, null, 2));
                
                if (!sessionDoc.sessions[userId]) {
                    console.error(`❌ No sessions found for user ${userId}`);
                    console.log(`👥 Available users:`, Object.keys(sessionDoc.sessions));
                    return;
                }
                
                console.log(`✅ User has ${sessionDoc.sessions[userId].length} session(s)`);
                
                const activeSession = sessionDoc.sessions[userId].find(s => s.end === null);
                if (!activeSession) {
                    console.error(`❌ No active session found for ${userId}`);
                    console.log(`📊 User sessions:`, JSON.stringify(sessionDoc.sessions[userId], null, 2));
                    return;
                }
                
                console.log(`✅ Found active session: ${activeSession.sessionId}`);
                console.log(`📝 Updating end time from null to ${endTime}s`);
                
                activeSession.end = endTime;
                sessionDoc.markModified('sessions');
                
                console.log(`💾 Saving to database...`);
                await sessionDoc.save();
                
                console.log(`✅ Session closed successfully!`);
                console.log(`📊 Updated session:`, JSON.stringify(activeSession, null, 2));

                socket.leave(meetingId);
                console.log(`✅ LEAVE COMPLETE\n`);
            } catch (err) {
                console.error("❌ Error in leave_meeting:", err);
                console.error("Stack:", err.stack);
            }
        });

        socket.on("start_recording", (meetingId) => {
            console.log(`🔴 start_recording from: ${socket.id} for meeting: ${meetingId}`);
            
            // Set recording state for this meeting
            meetingRecordingState.set(meetingId, true);
            console.log(`✅ Recording state set to TRUE for meeting: ${meetingId}`);
            
            // Broadcast to all users in the meeting
            io.to(meetingId).emit("start_recording");
        });

        socket.on("stop_recording", async (meetingId) => {
            console.log(`⏹️ stop_recording from: ${socket.id} for meeting: ${meetingId}`);
            
            // Clear recording state for this meeting
            meetingRecordingState.set(meetingId, false);
            console.log(`✅ Recording state set to FALSE for meeting: ${meetingId}`);
            
            await addJobToQueue(meetingId);
            
            // Broadcast to all users in the meeting
            io.to(meetingId).emit("stop_recording");
        });

        socket.on("disconnect", async () => {
            console.log("socket disconnected:", socket.id);
            
            // Note: We can't reliably track which user disconnected without additional mapping
            // This is a limitation of the simplified approach
        });
    });
}

