import { mergeAndDownloadVideo } from "../services/FFmpeg.js";
import { MeetingDB, MeetingParticipantDB, SessionDB } from "../models/model.js";
import { addJobToQueue } from "../services/queueService.js";

let current_meeting_id = null;
let sessionCounters = {}; // Track session counters per meeting

export function socketHandler(io) {
        io.on("connection", (socket) => {
        console.log("socket connected:", socket.id);

        // client tells which meeting they belong to
        socket.on("join_meeting", async ({ meetingId, userId, sessionId }) => {
            try {
                current_meeting_id = meetingId;
                socket.join(meetingId);
        
                console.log(`${socket.id} joined meeting: ${meetingId} with sessionId: ${sessionId}`);

                // Create session record in database
                try {
                    const newSession = await SessionDB.create({
                        sessionId: sessionId,
                        meetingId: meetingId,
                        userId: userId,
                        startTime: new Date(),
                        endTime: null
                    });
                    console.log(`✅ Session created: ${sessionId}`);
                } catch (sessionError) {
                    console.error("Error creating session:", sessionError);
                }

                // Add participant to DB if not already present
                const participant = await MeetingDB.findOne({})
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
                    } else {
                        console.log(`Participant ${userId} already exists in meeting ${meetingId}`);
                    }
                }

                // Increment session counter for this meeting
                if (!sessionCounters[meetingId]) {
                    sessionCounters[meetingId] = 1;
                } else {
                    sessionCounters[meetingId]++;
                }

                // Broadcast updated session counter to all clients in the meeting
                io.to(meetingId).emit("session_counter_updated", {
                    meetingId: meetingId,
                    counter: sessionCounters[meetingId]
                });

                // Acknowledge join
                socket.emit("joined_meeting", meetingId);

            } catch (err) {
                console.error("Error in join_meeting:", err);
                socket.emit("join_error", "Unable to join meeting");
            }
        });


        socket.on("start_recording", (meetingId) => {
            console.log("tello")
            console.log("start_recording from:", socket.id);
            io.to(meetingId).emit("start_recording");

        });

        socket.on("participant_count", (count) => {
            console.log("the count is");
            console.log(count);
        });



        socket.on("stop_recording", async (meetingId) => {
            console.log("stop_recording from:", socket.id);
            await addJobToQueue(meetingId);
            io.to(meetingId).emit("stop_recording");

        });

        socket.on("merge_and_download_videos", async(meetingId) => { 
            console.log("merge and downlaod video socket triggered");
            // mergeAndDownloadVideo(meetingId);
           
        })

        socket.on("disconnect", () => {
            console.log("socket disconnected:", socket.id);
            if (current_meeting_id) {
                // updateParticipantCount(current_meeting_id, io);
            }
        });

        // Handle session end when user leaves
        socket.on("leave_meeting", async ({ sessionId, meetingId, userId }) => {
            try {
                // Update session endTime
                const session = await SessionDB.findOneAndUpdate(
                    { sessionId: sessionId },
                    { endTime: new Date() },
                    { new: true }
                );
                
                if (session) {
                    console.log(`✅ Session ended: ${sessionId}`);
                    
                    // Increment counter and create new session for rejoin
                    if (!sessionCounters[meetingId]) {
                        sessionCounters[meetingId] = 1;
                    } else {
                        sessionCounters[meetingId]++;
                    }
                    
                    const newSessionId = `${userId}_${sessionCounters[meetingId]}`;
                    
                    // Create new session record for potential rejoin
                    const newSession = await SessionDB.create({
                        sessionId: newSessionId,
                        meetingId: meetingId,
                        userId: userId,
                        startTime: new Date(),
                        endTime: null
                    });
                    
                    console.log(`✅ New session created for rejoin: ${newSessionId}`);
                    
                    // Broadcast updated counter and new sessionId to the user
                    socket.emit("session_rejoined", {
                        newSessionId: newSessionId,
                        counter: sessionCounters[meetingId]
                    });
                    
                    // Broadcast updated counter to all clients in the meeting
                    io.to(meetingId).emit("session_counter_updated", {
                        meetingId: meetingId,
                        counter: sessionCounters[meetingId]
                    });
                } else {
                    console.log(`⚠️ Session not found: ${sessionId}`);
                }
            } catch (error) {
                console.error("Error ending session:", error);
            }
        });
    });

}

