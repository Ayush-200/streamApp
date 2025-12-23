import multer from 'multer';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import { StreamClient } from "@stream-io/node-sdk";
import {MeetingParticipantDB } from '../MongoDB/model.js';
import { handleUpload } from '../services/handleUpload.js';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const client = new StreamClient(apiKey, apiSecret);
const ffmpegUrl = process.env.FFMPEG_WORKER_URL;

export const handleUpload = (async (req, res) => {
    const { meetingId } = req.params;

    console.log('content-type:', req.headers['content-type']);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file && req.file.originalname);

    // Accept either a file upload form (multipart/form-data) or JSON body
    const { userId, videoPublicId } = req.body || {};

    if (!userId || !videoPublicId) {
        return res.status(400).json({ error: "userId and videoPublicId are required" });
    }

    try {
        // Find meeting
        const meeting = await MeetingParticipantDB.findOne({ meetingId });
        if (!meeting) return res.status(404).json({ error: "Meeting not found" });

        // Find participant
        const participant = meeting.participants.find(p => p.userId === userId);
        if (!participant) return res.status(404).json({ error: "Participant not found" });

        // Update participant's uploaded video info
        participant.videoPublicId = videoPublicId;
        participant.uploadTime = new Date(); // optional: can track upload time

        await meeting.save();

        // Check if all participants uploaded
        const allUploaded = meeting.participants.every(p => p.videoPublicId);
        console.log("allUploaded", allUploaded);
        if (allUploaded) {
            console.log("All participants uploaded → merging videos...");
            const videoUrls = meeting.participants.map(p => p.videoPublicId);
            try {
                const mergedVideos = await axios.post(`${ffmpegUrl}/stitch`,
                    { videoUrls: videoUrls })
                return res.json({ success: true, mergedVideoUrl: mergedVideos.data.url });
            } catch (err) {
                console.error("Error merging videos:", err);
            }
        }
    } catch (err) {
        console.error("Error saving participant upload:", err);
        return res.status(500).json({ error: err.message });
    }
});