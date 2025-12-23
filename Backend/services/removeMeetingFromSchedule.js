import { User } from '../MongoDB/model.js'

export const removeMeetingFromSchedule = (async (req, res) =>{
    const email = req.params.emailId;
    const user = await User.findById(email);

if (user) {
  const index = user.meeting.indexOf(meetingToRemove);
  
  if (index !== -1) {
    user.meeting.splice(index, 1); // remove meeting
    user.date.splice(index, 1);    // remove corresponding date
    await user.save();
  }
}
})