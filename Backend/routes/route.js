import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { StreamClient  } from "@stream-io/node-sdk";
const router = express.Router();

import { getAlreadyCreatedMeeting } from '../utils/getAlreadyCreatedMeeting.js';
import { deleteMeetingName } from '../utils/deleteMeetingName.js';
import { removeMeetingFromSchedule } from '../utils/removeMeetingFromSchedule.js';
import { uploadMeeting } from '../services/uploadMeeting.js';
import { getUserMeetings } from '../services/getUserMeetings.js';
import { addUserMeeting } from '../utils/addUserMeeting.js';
import { addMeetingName } from '../utils/addMeetingName.js';
import { uploadBlob } from '../utils/uploadBlob.js';
import multer from 'multer';
import {getMeetingId} from '../utils/getMeetingId.js';
import { SessionDB, MeetingDB, MeetingParticipantDB } from '../models/model.js';

// Setup multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET; 
const client = new StreamClient(apiKey, apiSecret);


router.get('/', async(req,res) =>{
    res.json({ message: "API routes working" });
})

router.get('/token/:userId', (req, res)=>{
    const userId = req.params.userId;
    const validity = 24*60*60;
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: validity });
    res.json({token});
})

router.post('/upload/:meetingId', uploadMeeting);

router.get("/getUserMeetings/:emailId", getUserMeetings);

router.post('/addUsersMeetings/:emailId', addUserMeeting);

router.get("/getAlreadyCreatedMeeting/:meetingName", getAlreadyCreatedMeeting);

router.get('/addMeetingName/:meetingName', addMeetingName);

router.get('/deleteMeetingName/:meetingName', deleteMeetingName);

router.post('/removeMeetingFromSchedule/:emailId', removeMeetingFromSchedule);

router.post('/uploadChunk/:meetingId', upload.single('file'), uploadBlob);

router.get('/getMeetingId/:meetingName', getMeetingId);

// Get last segment index for a user in a meeting
router.get('/getLastSegmentIndex/:meetingName/:userId', async (req, res) => {
    try {
        const { meetingName, userId } = req.params;
        
        console.log(`📊 [GET_LAST_SEGMENT] Request for meeting: ${meetingName}, user: ${userId}`);
        
        // Try to find meeting by meetingName first, then by meetingId
        let meetingDoc = await MeetingDB.findOne({ meetingName });
        
        if (!meetingDoc) {
            // Maybe meetingName is actually a meetingId, try that
            meetingDoc = await MeetingDB.findOne({ meetingId: meetingName });
        }
        
        if (!meetingDoc) {
            console.log(`❌ [GET_LAST_SEGMENT] Meeting not found: ${meetingName}`);
            return res.json({ 
                lastSegmentIndex: -1,
                message: "Meeting not found in database"
            });
        }
        
        const meetingId = meetingDoc.meetingId;
        console.log(`✅ [GET_LAST_SEGMENT] Found meeting with ID: ${meetingId}`);
        
        // Find participant in MeetingParticipant collection
        const participantDoc = await MeetingParticipantDB.findOne({ meetingId });
        
        if (!participantDoc) {
            console.log(`📊 [GET_LAST_SEGMENT] No participants found for meeting: ${meetingId}`);
            return res.json({ lastSegmentIndex: -1 });
        }
        
        const participant = participantDoc.participants.find(p => p.userId === userId);
        
        if (!participant) {
            console.log(`📊 [GET_LAST_SEGMENT] User ${userId} not found in participants`);
            return res.json({ lastSegmentIndex: -1 });
        }
        
        if (participant.lastSegmentIndex === undefined || participant.lastSegmentIndex === null) {
            console.log(`📊 [GET_LAST_SEGMENT] No lastSegmentIndex set for user ${userId}`);
            return res.json({ lastSegmentIndex: -1 });
        }
        
        console.log(`✅ [GET_LAST_SEGMENT] Found lastSegmentIndex: ${participant.lastSegmentIndex} for user ${userId}`);
        
        res.json({ 
            lastSegmentIndex: participant.lastSegmentIndex,
            meetingId: meetingId
        });
    } catch (error) {
        console.error("❌ [GET_LAST_SEGMENT] Error:", error);
        res.status(500).json({ 
            error: "Server error",
            lastSegmentIndex: -1 
        });
    }
});

router.post('/uploadSegment/:meetingId', upload.single('file'), uploadBlob);

// Update chunk timing for session tracking
router.post('/sessions/update-chunk', async (req, res) => {
    try {
        const { meetingId, userEmail, sessionId, start, end } = req.body;
        
        console.log(`📊 [UPDATE_CHUNK] Received timing update for ${sessionId}: ${start}s - ${end}s`);
        
        // Validate input
        if (!meetingId || !userEmail || !sessionId || start === undefined || end === undefined) {
            return res.status(400).json({ 
                error: "Missing required fields",
                required: ["meetingId", "userEmail", "sessionId", "start", "end"]
            });
        }
        
        // Find or create session document
        let sessionDoc = await SessionDB.findOne({ meetingId });
        
        if (!sessionDoc) {
            console.log(`📊 [UPDATE_CHUNK] Creating new session document for meeting: ${meetingId}`);
            sessionDoc = new SessionDB({
                meetingId,
                callStartTime: new Date(),
                sessions: {}
            });
        }
        
        // Initialize user's session array if needed
        if (!sessionDoc.sessions) {
            sessionDoc.sessions = {};
        }
        if (!sessionDoc.sessions[userEmail]) {
            sessionDoc.sessions[userEmail] = [];
        }
        
        // Add or update chunk timing
        const existingIndex = sessionDoc.sessions[userEmail].findIndex(s => s.sessionId === sessionId);
        
        if (existingIndex >= 0) {
            // Update existing entry
            console.log(`📊 [UPDATE_CHUNK] Updating existing session entry for ${sessionId}`);
            sessionDoc.sessions[userEmail][existingIndex] = { sessionId, start, end };
        } else {
            // Add new entry
            console.log(`📊 [UPDATE_CHUNK] Adding new session entry for ${sessionId}`);
            sessionDoc.sessions[userEmail].push({ sessionId, start, end });
        }
        
        // Mark nested object as modified for Mongoose
        sessionDoc.markModified('sessions');
        await sessionDoc.save();
        
        console.log(`✅ [UPDATE_CHUNK] Session timing saved successfully`);
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ [UPDATE_CHUNK] Error updating chunk timing:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get sessions for a meeting
router.get('/sessions/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const sessionDoc = await SessionDB.findOne({ meetingId });
        
        if (!sessionDoc) {
            return res.status(404).json({ 
                error: "No sessions found",
                meetingId 
            });
        }
        
        res.json({
            meetingId,
            callStartTime: sessionDoc.callStartTime,
            sessions: sessionDoc.sessions
        });
    } catch (error) {
        console.error("Error fetching sessions:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// Get ALL sessions (for debugging)
router.get('/sessions', async (req, res) => {
    try {
        const allSessions = await SessionDB.find({});
        res.json({
            count: allSessions.length,
            sessions: allSessions
        });
    } catch (error) {
        console.error("Error fetching all sessions:", error);
        res.status(500).json({ error: "Server error" });
    }
});

export default router; 
