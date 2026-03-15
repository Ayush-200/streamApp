import { MeetingParticipantDB, MeetingDB } from "../models/model.js";
import { mergeAndDownloadVideo } from "../services/FFmpeg.js";

async function updateParticipantCount(meetingId, io){
    const room = io.sockets.adapter.rooms.get(meetingId);
    const participantCount = room ? room.size : 0;

    // Persist the current count to DB (upsert if needed)
    await MeetingParticipantDB.findOneAndUpdate(
        { meetingId: meetingId },
        { $set: { participantCount } },
        { new: true, upsert: true }
    );

    // Send count to all participants in this room
    io.to(meetingId).emit("participant_count", participantCount);
    console.log("here number of participants is", participantCount);

    if (participantCount === 0) {
        await MeetingDB.deleteOne({ meetingName: meetingId });
        mergeAndDownloadVideo(meetingId);
        console.log("Meeting deleted because no participants left");
    }

}

export default updateParticipantCount;
