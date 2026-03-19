import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { StreamClient  } from "@stream-io/node-sdk";
const router = express.Router();

import { getAlreadyCreatedMeeting } from '../utils/getAlreadyCreatedMeeting.js';
import { deleteMeetingName } from '../utils/deleteMeetingName.js';
import { removeMeetingFromSchedule } from '../utils/removeMeetingFromSchedule.js';
import { uploadMeeting } from '../services/uploadMeeting.js';
import { getUserMeetings } from '../services/getUserMeetings.js';
import { addUserMeeting } from '../utils/addUserMeeting.js';
import { addMeetingName } from '../utils/addMeetingName.js';
import { uploadBlob } from '../utils/uploadBlob.js';
import multer from 'multer';
import {getMeetingId} from '../utils/getMeetingId.js'

// Setup multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET; 
const client = new StreamClient(apiKey, apiSecret);


router.get('/', async(req,res) =>{
    res.json({ message: "API routes working" });
})

router.get('/token/:userId', (req, res)=>{
    const userId = req.params.userId;
    const validity = 24*60*60;
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: validity });
    res.json({token});
})

router.post('/upload/:meetingId', uploadMeeting);

router.get("/getUserMeetings/:emailId", getUserMeetings);

router.post('/addUsersMeetings/:emailId', addUserMeeting);

router.get("/getAlreadyCreatedMeeting/:meetingName", getAlreadyCreatedMeeting);

router.get('/addMeetingName/:meetingName', addMeetingName);

router.get('/deleteMeetingName/:meetingName', deleteMeetingName);

router.post('/removeMeetingFromSchedule/:emailId', removeMeetingFromSchedule);

router.post('/uploadChunk/:meetingId', upload.single('file'), uploadBlob);

router.get('/getMeetingId/:meetingName', getMeetingId);

router.post('/uploadSegment/:meetingId', upload.single('file'), uploadBlob); // Reuse uploadBlob handler

export default router; 
