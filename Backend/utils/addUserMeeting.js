import { User } from '../models/model.js'

export const addUserMeeting = async (req, res) => {
    const email = req.params.emailId;
    const { newMeeting, newDate } = req.body; 

    const updatedUser = await User.findOneAndUpdate(
        { email }, 
        {
            $push: {
                meeting: newMeeting, 
                date: newDate
            }
        }, 
        { new: true, upsert: true }
    );
    res.json(updatedUser);
}
