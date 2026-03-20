import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {type: String, required: true}, 
    email: {type: String, required: true, unique: true},
    meeting: {type: [String], default: []},   
    createdAt: {type: Date, default: Date.now}, 
    date: {type: [Date]}
})


const meetingSchema = new mongoose.Schema({
    meetingName: {type: String, required: true},
    meetingId: {type: String, required: true, unique: true}, // Unique ID for Cloudinary
    createdAt: {type: Date, default: Date.now}
})


const ParticipantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  joinTime: { type: Date, required: true },
  leaveTime: { type: Date }, // can be null until they leave
  videoPublicId: { type: String }, // filled after upload
  chunks: [{
    chunkIndex: Number,
    cloudinaryUrl: String,
    uploadTime: Date
  }]
});

const meetingParticipantSchema = new mongoose.Schema({
  meetingId: { type: String, required: true },
  participantCount: {type: Number, default: 0},
  participants: { type: [ParticipantSchema], default: [] }
});

// New Session Schema for tracking user sessions
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  meetingId: { type: String, required: true },
  userId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null }
});

   export const User = mongoose.model('User', userSchema);
   export const MeetingDB = mongoose.model('Meeting', meetingSchema);
   export const MeetingParticipantDB = mongoose.model('MeetingParticipant', meetingParticipantSchema);
   export const SessionDB = mongoose.model('Session', sessionSchema);
//    export const VideoSchemaDB = mongoose.model('VideoSchemaDB', VideoSchema);
//    export default {User, MeetingDB};
 