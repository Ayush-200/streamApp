import { User } from '../MongoDB/model.js';
import dotenv from 'dotenv';
dotenv.config();

export const removeMeetingFromSchedule = (async (req, res) => {
    const email = req.params.emailId;
    const { meetingToRemove } = req.body;
    
    try {
        const user = await User.findOne({ email });

        if (user) {
            const index = user.meeting.indexOf(meetingToRemove);

            if (index !== -1) {
                user.meeting.splice(index, 1); // remove meeting
                user.date.splice(index, 1);    // remove corresponding date
                await user.save();
                res.json({ success: true, message: "Meeting removed" });
            } else {
                res.status(404).json({ error: "Meeting not found" });
            }
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        console.error("Error removing meeting:", err);
        res.status(500).json({ error: err.message });
    }
})