import { MeetingParticipantDB } from '../models/model.js'
import axios from 'axios';

export const uploadMeeting = async (req, res) => {
    const { meetingId } = req.params;
    const { userId, videoPublicId } = req.body || {};

    if (!userId || !videoPublicId) {
        return res.status(400).json({ error: "userId and videoPublicId are required" });
    }

    const meeting = await MeetingParticipantDB.findOne({ meetingId });
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    const participant = meeting.participants.find(p => p.userId === userId);
    if (!participant) return res.status(404).json({ error: "Participant not found" });

    participant.videoPublicId = videoPublicId;
    await meeting.save();

    const allUploaded = meeting.participants.every(p => p.videoPublicId);
    
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
                    return true;
                } catch (error) {
                    console.error(`❌ Video ${index + 1} validation failed:`, error.message);
                    return false;
                }
            })
        );
        
        if (!validationResults.every(result => result === true)) {
            return res.status(400).json({ 
                error: "Video validation failed"
            });
        }
        
        const mergedVideos = await axios.post('http://65.2.52.52:8080/stitch', { 
            videoUrls,
            options: {
                useAudioMixing: true,
                reEncode: true,
                avSync: true,
                minSegmentDuration: 0.1
            }
        });
        
        return res.json({ 
            success: true, 
            mergedVideoUrl: mergedVideos.data.url 
        });
    }
    
    res.json({ success: true, message: "Video uploaded" });
};
