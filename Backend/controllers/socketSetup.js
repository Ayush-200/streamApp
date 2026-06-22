import { socketAuthMiddleware } from "./socketAuth.js";
import { handleJoinMeeting, handleLeaveMeeting, handleDisconnect } from "./meetingEvents.js";
import { handleStartRecording, handleStopRecording } from "./recordingEvents.js";

const meetingRecordingState = new Map();

export function socketHandler(io) {
    io.use(socketAuthMiddleware);

    io.on("connection", (socket) => {
        console.log("✅ Socket connected:", socket.id, "User:", socket.user?.email);

        socket.on("join_meeting", (data) => handleJoinMeeting(io, socket, data, meetingRecordingState));

        socket.on("leave_meeting", (data) => handleLeaveMeeting(io, socket, data, meetingRecordingState));

        socket.on("start_recording", (meetingId) => handleStartRecording(io, socket, meetingId, meetingRecordingState));

        socket.on("stop_recording", (meetingId) => handleStopRecording(io, socket, meetingId, meetingRecordingState));

        socket.on("disconnect", () => handleDisconnect(io, socket, meetingRecordingState));
    });
}
