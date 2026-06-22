import { MeetingDB, MeetingParticipantDB } from '../models/model.js';

export const getLastSegmentIndex = async (req, res) => {
    const { meetingName, userId } = req.params;

    let meetingDoc = await MeetingDB.findOne({ meetingName });
    if (!meetingDoc) {
        meetingDoc = await MeetingDB.findOne({ meetingId: meetingName });
    }

    if (!meetingDoc) {
        return res.json({ lastSegmentIndex: -1 });
    }

    const meetingId = meetingDoc.meetingId;
    const participantDoc = await MeetingParticipantDB.findOne({ meetingId });

    if (!participantDoc) {
        return res.json({ lastSegmentIndex: -1 });
    }

    const participant = participantDoc.participants.find(p => p.userId === userId);

    if (!participant || participant.lastSegmentIndex === undefined) {
        return res.json({ lastSegmentIndex: -1 });
    }

    res.json({
        lastSegmentIndex: participant.lastSegmentIndex,
        meetingId
    });
};
