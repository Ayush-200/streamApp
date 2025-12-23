import express from 'express';
const router = express.Router();
import { handleUpload } from '../services/handleUpload.js';
import { getUserMeetings } from '../services/getUserMeeting.js';
import { addUsersMeetings } from '../services/addUserMeeting.js';
import { getAlreadyCreatedMeeting } from '../services/getAlreadyCreatedMeeting.js';
import { addMeeting } from '../services/addMeeting.js';
import { deleteMeeting } from '../services/deleteMeeting.js';
import { generateUserToken } from '../services/generateToken.js';
import { removeMeetingFromSchedule } from '../services/removeMeetingFromSchedule.js';
import dotenv from 'dotenv';
dotenv.config();


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