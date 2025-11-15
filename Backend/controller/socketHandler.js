import { mergeAndDownloadVideo } from "../FFmpeg.js";
import { MeetingDB } from "../MongoDB/model.js";
let current_meeting_id = null;
export function socketHandler(io) {
    io.on("connection", (socket) => {
        console.log("socket connected:", socket.id);

        // client tells which meeting they belong to
        socket.on("join_meeting", (meetingId) => {
            current_meeting_id = meetingId;
            socket.join(meetingId);
            console.log(`${socket.id} joined meeting: ${meetingId}`);

            updateParticipantCount(current_meeting_id, io);

            // acknowledge join
            socket.emit("joined_meeting", meetingId);
        });

        socket.on("start_recording", (meetingId) => {
            console.log("start_recording from:", socket.id);

            io.emit("start_recording");

        });

        socket.on("participant_count", (count) => {
            console.log("the count is");
            console.log(count);
        });



        socket.on("stop_recording", async (meetingId) => {
            console.log("stop_recording from:", socket.id);
            io.to(meetingId).emit("stop_recording");

            // io.to(meetingId).emit("merge_and_download_videos", meetingId);
            // await mergeAndDownloadVideo(meetingId);
            // io.to(meetingId).emit("download_ready", ({url: `/download/${meetingId}`}));


        });

        socket.on("disconnect", () => {

            console.log("socket disconnected:", socket.id);
            if (current_meeting_id) {
                updateParticipantCount(current_meeting_id, io);
            }
        });
    });

}


async function updateParticipantCount(meetingId, io){
  
    const room = io.sockets.adapter.rooms.get(meetingId);
    const participantCount = room ? room.size : 0;

    // ✅ Send count to all participants in this room
    io.to(meetingId).emit("participant_count", participantCount);
    console.log("here number of participants is");
    console.log(participantCount);
    if(participantCount === 0){
        await MeetingDB.deleteOne({ meetingName: meetingId });
        console.log("Meeting deleted because no participants left");
    }

}
