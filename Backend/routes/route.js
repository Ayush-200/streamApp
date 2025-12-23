import express from 'express';
import { StreamClient } from "@stream-io/node-sdk";
const router = express.Router();
import { User, MeetingDB, MeetingParticipantDB } from '../MongoDB/model.js';
import { handleUpload } from '../services/handleUpload.js';

import dotenv from 'dotenv';
import { getUserMeetings } from '../services/getUserMeeting.js';
import { addUsersMeetings } from '../services/addUserMeeting.js';
import { getAlreadyCreatedMeeting } from '../services/getAlreadyCreatedMeeting.js';
import { addMeeting } from '../services/addMeeting.js';
import { deleteMeeting } from '../services/deleteMeeting.js';
import { generateUserToken } from '../services/generateToken.js';
dotenv.config();

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const client = new StreamClient(apiKey, apiSecret);
const ffmpegUrl = process.env.FFMPEG_WORKER_URL;


router.get('/', async (req, res) => {
    res.json({ message: "API routes working" });
})

router.get('/token/:userId', generateUserToken);

router.post('/upload/:meetingId',handleUpload);

router.get("/getUserMeetings/:emailId", getUserMeetings);

router.post('/addUsersMeetings/:emailId', addUsersMeetings);

router.get("/getAlreadyCreatedMeeting/:meetingName", getAlreadyCreatedMeeting);

router.get('/addMeetingName/:meetingName', addMeeting);

router.get('/deleteMeetingName/:meetingName', deleteMeeting);

router.post('/removeMeetingFromSchedule/:emailId',removeMeetingFromSchedule)

export default router; 