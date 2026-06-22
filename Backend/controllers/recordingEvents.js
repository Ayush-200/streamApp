import { validateRecordingEvent } from "../middleware/socketValidators.js";
import { saveMeetingSessionsToDB } from "../services/sessionManager.js";
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
    await saveMeetingSessionsToDB(meetingId);
    await addJobToQueue(meetingId);
    io.to(meetingId).emit("stop_recording");
}
