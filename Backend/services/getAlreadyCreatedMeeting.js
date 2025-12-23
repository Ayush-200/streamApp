import { MeetingDB } from '../MongoDB/model.js';
import dotenv from 'dotenv';
dotenv.config();

export const getAlreadyCreatedMeeting = (async (req, res) => {
    const meetingName = req.params.meetingName;
    const response = await MeetingDB.findOne({ meetingName });
    if (!response) {
        console.log("inside false");
        res.json(false);
    }

    else {
        res.json(true);
    }
})
