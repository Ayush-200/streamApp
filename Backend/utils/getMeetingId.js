import { MeetingDB } from "../models/model.js";

export const getMeetingId = async (req, res) => {
    const meetingName = req.params.meetingName;
    
    try{
        const meeting = await MeetingDB.findOne({
            meetingName: meetingName
        });
        
        if (!meeting) {
            return res.status(404).json({ 
                error: "Meeting not found",
                message: `No meeting found with name: ${meetingName}` 
            });
        }
        
        res.json({ 
            meetingId: meeting.meetingId,
            meetingName: meeting.meetingName 
        });
    }catch(err){
        console.log("Error occurred in fetching the meeting id:", err);
        res.status(500).json({ 
            error: "Server error",
            message: "Failed to fetch meeting ID" 
        });
    }
}