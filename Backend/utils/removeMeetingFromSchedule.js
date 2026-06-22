import { User } from '../models/model.js'

export const removeMeetingFromSchedule = async (req, res) => {
    const email = req.params.emailId;
    const { meetingToRemove } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    
    const index = user.meeting.indexOf(meetingToRemove);
    
    if (index !== -1) {
        user.meeting.splice(index, 1);
        user.date.splice(index, 1);
        await user.save();
    }
    
    res.json({ message: "Meeting removed from schedule" });
}