import { MeetingDB } from '../models/model.js'

export const deleteMeetingName = async (req, res) => {
    const meetingName = req.params.meetingName;
    await MeetingDB.deleteOne({ meetingName });
    res.status(200).json({ message: "Meeting deleted successfully" });
}