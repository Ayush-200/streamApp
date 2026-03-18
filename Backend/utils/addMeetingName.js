import { MeetingDB } from '../models/model.js'
import { nanoid } from 'nanoid'

export const addMeetingName = (async(req, res)=>{
    try{
    const meetingName = req.params.meetingName;
    const meetingId = nanoid(12); // Generate unique 12-character ID
    
    const response = await MeetingDB.create({
        meetingName: meetingName,
        meetingId: meetingId
    });

    console.log("meeting added to DB successfully", response);
    res.status(201).json({
        message: "meeting added success",
        meetingId: meetingId,
        meetingName: meetingName
    });
    }catch(err){
        console.log(err);
        res.status(400).json({message: "there is error in adding meeting in meeting list"});
    }
})