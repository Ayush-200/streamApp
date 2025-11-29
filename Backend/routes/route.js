import express from 'express';
import { StreamClient  } from "@stream-io/node-sdk";
const router = express.Router();
import { User, MeetingDB, MeetingParticipantDB } from '../MongoDB/model.js'
import cloudinary from '../index.js';
import multer from 'multer';
import { mergeAndDownloadVideo } from '../FFmpeg.js';
import axios from 'axios';
// import User from '../MongoDB/model.js'
const apiKey = "55gcbd3wd3nk";
const apiSecret = "86wmmssfy926tzyvz3362j8f63mwrd2p2p9yex9ftgkpspchejmn8pzxp6zyscdg"; // keep private!
const client = new StreamClient(apiKey, apiSecret);


const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, "./uploads")
    }, 
    filename: function(req, file, cb){
        cb(null,  `${Date.now()}-${file.originalname}`);
    }
})
const upload = multer({ storage });


router.get('/', async(req,res) =>{
    const user = await User.findOne({email: ""});
})

router.get('/token/:userId', (req, res)=>{
    const userId = req.params.userId;
    const validity = 24*60*60;
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: validity });
    res.json({token});
})

router.post('/upload/:meetingId', async (req, res) => {
    const { meetingId } = req.params;

    console.log('content-type:', req.headers['content-type']);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file && req.file.originalname);

    // Accept either a file upload form (multipart/form-data) or JSON body
    const { userId, videoPublicId } = req.body || {};

    if (!userId || !videoPublicId) {
        return res.status(400).json({ error: "userId and videoPublicId are required" });
    }

    try {
        // Find meeting
        const meeting = await MeetingParticipantDB.findOne({ meetingId });
        if (!meeting) return res.status(404).json({ error: "Meeting not found" });

        // Find participant
        const participant = meeting.participants.find(p => p.userId === userId);
        if (!participant) return res.status(404).json({ error: "Participant not found" });

        // Update participant's uploaded video info
        participant.videoPublicId = videoPublicId;
        participant.uploadTime = new Date(); // optional: can track upload time

        await meeting.save();

        // Check if all participants uploaded
        const allUploaded = meeting.participants.every(p => p.videoPublicId);
        console.log("allUploaded", allUploaded);
        if (allUploaded) {
            console.log("All participants uploaded → merging videos...");
            const videoUrls = meeting.participants.map(p => p.videoPublicId);
            try{
                const mergedVideos = await axios.post('http:/15.207.63.218:8080/stitch',
                    { videoUrls: videoUrls})
                return res.json({ success: true, mergedVideoUrl: mergedVideos.data.url });
            }catch(err){
                console.error("Error merging videos:", err);
            }
        }
    } catch (err) {
        console.error("Error saving participant upload:", err);
        return res.status(500).json({ error: err.message });
    }
});


router.get("/getUserMeetings/:emailId", async(req, res) =>{ 
    const email = req.params.emailId;
    console.log(email);
    const response = await User.findOne({ email: email });
    if (!response) {
      return res.json({
        success: false,
        message: `No user found with email ${email}`,
        meeting: [],
        date: []
      });
    }
    const meeting = response.meeting;
    const dates = response.date;
    console.log(dates);
    console.log(meeting)
    console.log(response);
    res.json({meeting:meeting, date: dates});
})

router.post('/addUsersMeetings/:emailId', async (req, res) =>{
    const email = req.params.emailId;
    const { newMeeting, newDate } = req.body; 

    try{
        const updatedUser = await User.findOneAndUpdate(
            {email: email}, 
            {
                $push: {
                    meeting: newMeeting, 
                    date: newDate
                }
            }, 
            { new: true, upsert:true }
        );
        res.json(updatedUser);
    }catch(err){
        console.log("error in adding new meeting", err);
        res.status(500).json({ message: "Error adding meeting" });
    }
})

router.get("/getAlreadyCreatedMeeting/:meetingName", async (req, res)=>{
    const meetingName = req.params.meetingName;
    const response = await MeetingDB.findOne({ meetingName });
    if(!response){
        console.log("inside false");
        res.json(false);
    }

    else{
        res.json(true);
    }
})


router.get('/addMeetingName/:meetingName', async(req, res)=>{
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

router.get('/deleteMeetingName/:meetingName', async(req, res) =>{
    const meetingName = req.params.meetingName;
    await MeetingDB.deleteOne({ meetingName: meetingName});
     res.status(201).json({message: "meeting deleted successful"});
})

router.post('/removeMeetingFromSchedule/:emailId', async (req, res) =>{
    const email = req.params.emailId;
    const user = await User.findById(email);

if (user) {
  const index = user.meeting.indexOf(meetingToRemove);
  
  if (index !== -1) {
    user.meeting.splice(index, 1); // remove meeting
    user.date.splice(index, 1);    // remove corresponding date
    await user.save();
  }
}
})

// router.get('/getScheduledMeetings/:emailId', async (req, res) =>{
//     const emailId = req.params.emailId;
//     const response = await User.findOne({email: emailId});
//     const meetings
//     if(response){
//         res.status(200).json(response);
//     }
//     else {
//       return res.status(404).json({ message: "User not found" });
//     }
    
// })


export default router; 