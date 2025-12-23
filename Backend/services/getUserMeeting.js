import { User } from '../MongoDB/model.js';
import dotenv from 'dotenv';
dotenv.config();

export const getUserMeetings = (async (req, res) => {
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
    res.json({ meeting: meeting, date: dates });
})