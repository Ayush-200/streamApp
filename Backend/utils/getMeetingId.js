import { MeetingDB } from "../models/model.js";
export const getMeetingId = async (meetingName) => {

    let meeting;
    
    try{
        meeting = await MeetingDB.findOne({
            meetingName: meetingName
        })
    }catch(err){
        console.log("error occured in fetching the meeting id");
    }
    return meeting.meetingId;
}