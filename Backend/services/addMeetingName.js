import { MeetingDB } from '../MongoDB/model.js'


export const addMeetingName = (async(req, res)=>{
    try{
    const meetingName = req.params.meetingName;
    const response = await MeetingDB.create({meetingName:meetingName});

    console.log("meeting added to DB successfully", response);
    res.status(201).json({message: "meeting added success"});
    }catch(err){
        console.log(err);
        res.status(400).json({message: "there is error in adding meeting in meeting list"});
    }
})