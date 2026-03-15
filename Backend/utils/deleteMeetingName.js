import { MeetingDB } from '../models/model.js'

export const deleteMeetingName = (async(req, res) =>{
    const meetingName = req.params.meetingName;
    await MeetingDB.deleteOne({ meetingName: meetingName});
     res.status(201).json({message: "meeting deleted successful"});
})