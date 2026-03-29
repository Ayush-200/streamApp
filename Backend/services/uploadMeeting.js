import { MeetingParticipantDB } from '../models/model.js'
import multer from 'multer';
import axios from 'axios';

const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, "./uploads")
    }, 
    filename: function(req, file, cb){
        cb(null,  `${Date.now()}-${file.originalname}`);
    }
})
const upload = multer({ storage });


export const uploadMeeting =  (async (req, res) => {
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
            
            // Validate video files before processing
            const validationResults = await Promise.all(
                videoUrls.map(async (url, index) => {
                    try {
                        const response = await fetch(url, { method: 'HEAD' });
                        if (!response.ok) {
                            console.error(`❌ Video ${index + 1} not accessible: ${response.status}`);
                            return false;
                        }
                        console.log(`✅ Video ${index + 1} validated`);
                        return true;
                    } catch (error) {
                        console.error(`❌ Video ${index + 1} validation failed:`, error.message);
                        return false;
                    }
                })
            );
            
            if (!validationResults.every(result => result === true)) {
                return res.status(400).json({ 
                    error: "Video validation failed",
                    message: "One or more videos are not accessible"
                });
            }
            
            try{
                const mergedVideos = await axios.post('http://65.2.52.52:8080/stitch',
                    { 
                        videoUrls: videoUrls,
                        options: {
                            useAudioMixing: true,
                            reEncode: true,
                            avSync: true,
                            minSegmentDuration: 0.1
                        }
                    })
                return res.json({ success: true, mergedVideoUrl: mergedVideos.data.url });
            }catch(err){
                console.error("Error merging videos:", err);
                return res.status(500).json({ error: "Video merge failed" });
            }
        }
    } catch (err) {
        console.error("Error saving participant upload:", err);
        return res.status(500).json({ error: err.message });
    }
});
