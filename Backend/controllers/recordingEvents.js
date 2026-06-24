import { validateRecordingEvent } from "../middleware/socketValidators.js";
import { handleRecordingStarted, handleRecordingStopped, getUsersInMeeting } from "../services/sessionManager.js";
import { addJobToQueue } from "../services/queueService.js";

export function handleStartRecording(io, socket, meetingId, recordingState) {
    const validation = validateRecordingEvent(meetingId);
    if (!validation.valid) {
        console.error("❌ Start recording validation failed:", validation.errors);
        socket.emit("recording_error", { error: "Invalid meeting ID", details: validation.errors });
        return;
    }

    console.log(`🔴 Recording started: ${meetingId}`);
    recordingState.set(meetingId, true);

    // Create recording sessions for all users currently in the meeting
    const userIds = getUsersInMeeting(meetingId);
    console.log(`📋 Users in meeting: [${userIds.join(', ')}]`);
    userIds.forEach(userId => handleRecordingStarted(meetingId, userId));

    io.to(meetingId).emit("start_recording");
}

export async function handleStopRecording(io, socket, meetingId, recordingState) {
    const validation = validateRecordingEvent(meetingId);
    if (!validation.valid) {
        console.error("❌ Stop recording validation failed:", validation.errors);
        socket.emit("recording_error", { error: "Invalid meeting ID", details: validation.errors });
        return;
    }

    console.log(`⏹️ Recording stopped: ${meetingId}`);
    recordingState.set(meetingId, false);

    // Close recording sessions for all users currently in the meeting
    const userIds = getUsersInMeeting(meetingId);
    console.log(`📋 Users in meeting: [${userIds.join(', ')}]`);
    userIds.forEach(userId => handleRecordingStopped(meetingId, userId));

    // Don't save to DB here — sessions accumulate across multiple recordings.
    // saveMeetingSessionsToDB is called when the last participant leaves.
    await addJobToQueue(meetingId);
    io.to(meetingId).emit("stop_recording");
}
