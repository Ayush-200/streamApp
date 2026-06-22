import { MeetingDB } from '../models/model.js'
import { nanoid } from 'nanoid'

export const addMeetingName = async (req, res) => {
    const meetingName = req.params.meetingName;
    const meetingId = nanoid(12);
    
    const response = await MeetingDB.create({
        meetingName,
        meetingId
    });

    console.log("Meeting added to DB:", meetingId);
    res.status(201).json({
        message: "Meeting created successfully",
        meetingId,
        meetingName
    });
}