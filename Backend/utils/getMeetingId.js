import { MeetingDB } from "../models/model";
export const getMeetingId = (meetingName) => {
    
    try{
        const meeting = MeetingDB.findOne({
            meetingName: meetingName
        })
    }catch(err){
        console.log("error occured in fetching the meeting id");
    }
    return meeting.meetingId;
}