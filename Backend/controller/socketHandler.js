import { MeetingDB } from "../MongoDB/model.js";
import { MeetingParticipantDB } from "../MongoDB/model.js";
let current_meeting_id = null;
export function socketHandler(io) {
        io.on("connection", (socket) => {
        console.log("socket connected:", socket.id);

        // client tells which meeting they belong to
        socket.on("join_meeting", async ({ meetingId, userId }) => {
            try {
                current_meeting_id = meetingId;
                socket.join(meetingId);
        
                console.log(`${socket.id} joined meeting: ${meetingId}`);

                // Add participant to DB if not already present

                const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
                if (!meetingDoc) {
                    await MeetingParticipantDB.create({
                        meetingId,
                        participantCount: 1,
                        participants: [{ userId, joinTime: new Date() }]
                    });
                } else {
                        meetingDoc.participants.push({ userId, joinTime: new Date() });
                        meetingDoc.participantCount = meetingDoc.participants.length;
                        await meetingDoc.save();
                  
                }
                // Update everyone in meeting (emit current socket room size)
                await updateParticipantCount(meetingId, io);
                // Acknowledge join
                socket.emit("joined_meeting", meetingId);

            } catch (err) {
                console.error("Error in join_meeting:", err);
                socket.emit("join_error", "Unable to join meeting");
            }
        });


        socket.on("start_recording", (meetingId) => {
            console.log("start_recording from:", socket.id);

            io.to(meetingId).emit("start_recording");

        });

        socket.on("participant_count", (count) => {
            console.log("the count is");
            console.log(count);
        });



        socket.on("stop_recording", async (meetingId) => {
            console.log("stop_recording from:", socket.id);
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

    // Persist the current count to DB (upsert if needed)
    await MeetingParticipantDB.findOneAndUpdate(
        { meetingId: meetingId },
        { $set: { participantCount } },
        { new: true, upsert: true }
    );

    // ✅ Send count to all participants in this room
    io.to(meetingId).emit("participant_count", participantCount);
    console.log("here number of participants is", participantCount);

    if (participantCount === 0) {
        await MeetingDB.deleteOne({ meetingName: meetingId });
        console.log("Meeting deleted because no participants left");
    }

}
