import { ScheduledMeetingDB } from '../models/model.js';

export const scheduleMeeting = async (req, res) => {
    const { userId } = req.params;
    const { meetingName, scheduledDate, scheduledTime, description } = req.body;

    const scheduledMeeting = await ScheduledMeetingDB.create({
        userId,
        meetingName,
        scheduledDate,
        scheduledTime,
        description: description || '',
        status: 'scheduled'
    });

    res.json({
        success: true,
        meeting: scheduledMeeting
    });
};

export const getScheduledMeetings = async (req, res) => {
    const { userId } = req.params;

    const meetings = await ScheduledMeetingDB.find({ userId })
        .sort({ scheduledDate: 1, scheduledTime: 1 });

    res.json({
        meetings
    });
};

export const deleteScheduledMeeting = async (req, res) => {
    const { meetingId } = req.params;

    const deleted = await ScheduledMeetingDB.findByIdAndDelete(meetingId);

    if (!deleted) {
        return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({
        success: true,
        message: 'Meeting deleted'
    });
};

export const updateScheduledMeetingStatus = async (req, res) => {
    const { meetingId } = req.params;
    const { status } = req.body;

    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await ScheduledMeetingDB.findByIdAndUpdate(
        meetingId,
        { status },
        { new: true }
    );

    if (!updated) {
        return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({
        success: true,
        meeting: updated
    });
};
