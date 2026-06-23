import express from 'express';
import multer from 'multer';
import { getAlreadyCreatedMeeting } from '../utils/getAlreadyCreatedMeeting.js';
import { deleteMeetingName } from '../utils/deleteMeetingName.js';
import { removeMeetingFromSchedule } from '../utils/removeMeetingFromSchedule.js';
import { uploadMeeting } from '../services/meetingUpload.js';
import { getUserMeetings } from '../services/userMeetings.js';
import { addUserMeeting } from '../utils/addUserMeeting.js';
import { addMeetingName } from '../utils/addMeetingName.js';
import { uploadBlob } from '../utils/uploadBlob.js';
import { getMeetingId } from '../utils/getMeetingId.js';
import { rootHandler } from '../controllers/rootController.js';
import { generateToken } from '../controllers/tokenController.js';
import { getLastSegmentIndex } from '../controllers/lastSegmentController.js';
import { markUploadComplete } from '../controllers/uploadCompleteController.js';
import { scheduleMeeting, getScheduledMeetings, deleteScheduledMeeting, updateScheduledMeetingStatus } from '../controllers/scheduleController.js';
import {
    validateMeetingId,
    validateMeetingName,
    validateUserId,
    validateEmail,
    validateUploadMeeting,
    validateAddUserMeeting,
    validateRemoveMeeting,
    validateGetLastSegment,
    validateUploadComplete,
    validateScheduleMeeting,
    validateGetScheduledMeetings,
    validateDeleteScheduledMeeting
} from '../middleware/validators.js';
import { authenticate } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get('/', rootHandler);
router.get('/token/:userId', validateUserId, generateToken);
router.post('/upload/:meetingId', authenticate, validateUploadMeeting, uploadMeeting);
router.get("/getUserMeetings/:emailId", authenticate, validateEmail, getUserMeetings);
router.post('/addUsersMeetings/:emailId', authenticate, validateAddUserMeeting, addUserMeeting);
router.get("/getAlreadyCreatedMeeting/:meetingName", authenticate, validateMeetingName, getAlreadyCreatedMeeting);
router.get('/addMeetingName/:meetingName', authenticate, validateMeetingName, addMeetingName);
router.get('/deleteMeetingName/:meetingName', authenticate, validateMeetingName, deleteMeetingName);
router.post('/removeMeetingFromSchedule/:emailId', authenticate, validateRemoveMeeting, removeMeetingFromSchedule);
router.get('/getMeetingId/:meetingName', authenticate, validateMeetingName, getMeetingId);
router.get('/getLastSegmentIndex/:meetingName/:userId', authenticate, validateGetLastSegment, getLastSegmentIndex);
router.post('/uploadSegment/:meetingId', authenticate, validateMeetingId, upload.single('file'), uploadBlob);
router.post('/meeting/:meetingId/upload-complete', authenticate, validateUploadComplete, markUploadComplete);
router.post('/scheduleMeeting/:userId', authenticate, validateScheduleMeeting, scheduleMeeting);
router.get('/scheduledMeetings/:userId', authenticate, validateGetScheduledMeetings, getScheduledMeetings);
router.delete('/scheduledMeeting/:meetingId', authenticate, validateDeleteScheduledMeeting, deleteScheduledMeeting);
router.patch('/scheduledMeeting/:meetingId/status', authenticate, validateDeleteScheduledMeeting, updateScheduledMeetingStatus);

export default router;
