import { mergeAndDownloadVideo } from "../services/FFmpeg.js";
import { MeetingDB, MeetingParticipantDB } from "../models/model.js";
import { addJobToQueue } from "../services/queueService.js";
import { 
  handleUserJoined, 
  handleUserLeft, 
  handleUserDisconnect,
  getMeetingSessions,
  saveMeetingSessionsToDB,
  validateSessions,
  clearMeetingSessions
} from "../services/sessionTimeline.js";

// Track socket to meeting mapping
const socketMeetingMap = new Map();

export function socketHandler(io) {
    io.on("connection", (socket) => {
        console.log("socket connected:", socket.id);

        // client tells which meeting they belong to
        socket.on("join_meeting", async ({ meetingId, userId }) => {
            try {
                socket.join(meetingId);
                socketMeetingMap.set(socket.id, meetingId);
        
                console.log(`${socket.id} joined meeting: ${meetingId}`);

                // Track session timeline
                handleUserJoined(meetingId, userId, socket.id);

                // Add participant to DB if not already present
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

                // Acknowledge join
                socket.emit("joined_meeting", meetingId);

            } catch (err) {
                console.error("Error in join_meeting:", err);
                socket.emit("join_error", "Unable to join meeting");
            }
        });

        // Handle explicit user leave
        socket.on("leave_meeting", ({ meetingId, userId }) => {
            try {
                console.log(`User ${userId} explicitly leaving meeting ${meetingId}`);
                handleUserLeft(meetingId, userId);
                socket.leave(meetingId);
            } catch (err) {
                console.error("Error in leave_meeting:", err);
            }
        });

        socket.on("start_recording", (meetingId) => {
            console.log("start_recording from:", socket.id);
            io.to(meetingId).emit("start_recording");
        });

        socket.on("participant_count", (count) => {
            console.log("the count is", count);
        });

        socket.on("stop_recording", async (meetingId) => {
            console.log("stop_recording from:", socket.id);
            await addJobToQueue(meetingId);
            io.to(meetingId).emit("stop_recording");
        });

        // Get session timeline for a meeting
        socket.on("get_session_timeline", (meetingId) => {
            try {
                const sessions = getMeetingSessions(meetingId);
                socket.emit("session_timeline", { meetingId, sessions });
                console.log(`📊 Sent session timeline for meeting ${meetingId}`);
            } catch (err) {
                console.error("Error getting session timeline:", err);
                socket.emit("session_timeline_error", "Failed to get session timeline");
            }
        });

        // End meeting and save sessions
        socket.on("end_meeting", async (meetingId) => {
            try {
                console.log(`🏁 Ending meeting ${meetingId}`);
                
                // Validate sessions before saving
                const validation = validateSessions(meetingId);
                if (!validation.valid) {
                    console.error("Session validation failed:", validation.errors);
                }
                
                // Save to database
                const sessions = await saveMeetingSessionsToDB(meetingId);
                
                // Broadcast final timeline to all participants
                io.to(meetingId).emit("meeting_ended", { 
                    meetingId, 
                    sessions,
                    validation 
                });
                
                // Clear from memory
                clearMeetingSessions(meetingId);
                
                console.log(`✅ Meeting ${meetingId} ended and sessions saved`);
            } catch (err) {
                console.error("Error ending meeting:", err);
                socket.emit("end_meeting_error", "Failed to end meeting");
            }
        });

        socket.on("merge_and_download_videos", async(meetingId) => { 
            console.log("merge and download video socket triggered");
            // mergeAndDownloadVideo(meetingId);
        });

        socket.on("disconnect", () => {
            console.log("socket disconnected:", socket.id);
            
            // Handle unexpected disconnect
            const meetingId = socketMeetingMap.get(socket.id);
            if (meetingId) {
                handleUserDisconnect(meetingId, socket.id);
                socketMeetingMap.delete(socket.id);
            }
        });
    });
}

