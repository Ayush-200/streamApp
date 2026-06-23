import { MeetingParticipantDB } from "../models/model.js";
import { addJobToQueue } from "../services/queueService.js";

export const markUploadComplete = async (req, res) => {
    const { meetingId } = req.params;
    const { userId } = req.body;

    const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
    if (!meetingDoc) {
        return res.status(404).json({ error: "Meeting not found" });
    }

    const participant = meetingDoc.participants.find(p => p.userId === userId);
    if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
    }

    participant.allChunksUploaded = true;
    await meetingDoc.save();

    const allUploaded = meetingDoc.participants.every(p => p.allChunksUploaded);

    if (allUploaded) {
        await addJobToQueue(meetingId);
        console.log(`✅ All participants uploaded, queued meeting: ${meetingId}`);
    }

    res.json({ success: true, allUploaded });
};
