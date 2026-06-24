import { MeetingParticipantDB } from "../models/model.js";
import { validateJoinMeeting, validateLeaveMeeting } from "../middleware/socketValidators.js";
import {
  handleUserJoined,
  handleUserLeft,
  handleUserDisconnect,
  handleRecordingStarted,
  saveMeetingSessionsToDB,
  getActiveMeetingIds
} from "../services/sessionManager.js";

export async function handleJoinMeeting(io, socket, { meetingId, userId }, recordingState) {
    const validation = validateJoinMeeting({ meetingId, userId });
    if (!validation.valid) {
        console.error("❌ Join validation failed:", validation.errors);
        socket.emit("join_error", { error: "Invalid input", details: validation.errors });
        return;
    }

    console.log(`🚪 User ${userId} joining ${meetingId}`);

    socket.join(meetingId);

    handleUserJoined(meetingId, userId, socket.id);

    // If recording is active, create a recording session for the joining user
    if (recordingState.get(meetingId)) {
        handleRecordingStarted(meetingId, userId);
    }

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

    const isRecording = recordingState.get(meetingId) || false;
    socket.emit("joined_meeting", { meetingId, isRecording });
    console.log(`✅ ${userId} joined (recording: ${isRecording})`);
}

export async function handleLeaveMeeting(io, socket, { meetingId, userId, lastSegmentIndex }, recordingState) {
    const validation = validateLeaveMeeting({ meetingId, userId, lastSegmentIndex });
    if (!validation.valid) {
        console.error("❌ Leave validation failed:", validation.errors);
        socket.emit("leave_error", { error: "Invalid input", details: validation.errors });
        return;
    }

    console.log(`👋 User ${userId} leaving ${meetingId}`);

    handleUserLeft(meetingId, userId);

    if (lastSegmentIndex !== undefined && lastSegmentIndex >= 0) {
        const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
        if (meetingDoc) {
            const participant = meetingDoc.participants.find(p => p.userId === userId);
            if (participant) {
                participant.lastSegmentIndex = lastSegmentIndex;
                participant.leaveTime = new Date();
                await meetingDoc.save();
                console.log(`✅ Updated lastSegmentIndex: ${lastSegmentIndex}`);
            }
        }
    }

    socket.leave(meetingId);

    const room = io.sockets.adapter.rooms.get(meetingId);
    const participantCount = room ? room.size : 0;

    if (participantCount === 0) {
        await saveMeetingSessionsToDB(meetingId);
        recordingState.delete(meetingId);
        console.log(`🗑️ Meeting ${meetingId} is empty, cleaned up`);
    }
}

export async function handleDisconnect(io, socket, recordingState) {
    console.log("🔌 Socket disconnected:", socket.id);

    const activeMeetings = getActiveMeetingIds();
    for (const meetingId of activeMeetings) {
        const session = handleUserDisconnect(meetingId, socket.id);
        if (!session) continue;

        const room = io.sockets.adapter.rooms.get(meetingId);
        const participantCount = room ? room.size : 0;

        if (participantCount === 0) {
            await saveMeetingSessionsToDB(meetingId);
            recordingState.delete(meetingId);
            console.log(`🗑️ Meeting ${meetingId} is empty after disconnect, cleaned up`);
        }
    }
}
