import { User } from '../MongoDB/model.js'

export const addUserMeeting = (async (req, res) =>{
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
