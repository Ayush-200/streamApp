import { MeetingDB } from "../models/model.js";

export const getMeetingId = async (req, res) => {
    const meetingName = req.params.meetingName;
    
    const meeting = await MeetingDB.findOne({ meetingName });
    
    if (!meeting) {
        return res.status(404).json({ 
            error: "Meeting not found"
        });
    }
    
    res.json({ 
        meetingId: meeting.meetingId,
        meetingName: meeting.meetingName 
    });
}