import { User } from '../models/model.js'

export const getUserMeetings = async (req, res) => { 
    const email = req.params.emailId;
    const response = await User.findOne({ email });
    
    if (!response) {
        return res.json({
            success: false,
            message: `No user found with email ${email}`,
            meeting: [],
            date: []
        });
    }
    
    res.json({ 
        meeting: response.meeting, 
        date: response.date 
    });
}