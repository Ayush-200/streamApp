import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {type: String, required: true}, 
    email: {type: String, required: true, unique: true},
    meeting: {type: [String], default: []},   
    createdAt: {type: Date, default: Date.now}, 
    date: {type: [Date]}
})


const meetingSchema = new mongoose.Schema({
    meetingName: {type: String}
})


const ParticipantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  joinTime: { type: Date, required: true },
  leaveTime: { type: Date }, // can be null until they leave
  videoPublicId: { type: String } // filled after upload
});

const meetingParticipantSchema = new mongoose.Schema({
  meetingId: { type: String, required: true },
  participantCount: {type: Number, default: 0},
  participants: { type: [ParticipantSchema], default: [] }
});

   export const User = mongoose.model('User', userSchema);
   export const MeetingDB = mongoose.model('Meeting', meetingSchema);
   export const MeetingParticipantDB = mongoose.model('MeetingParticipant', meetingParticipantSchema);
//    export const VideoSchemaDB = mongoose.model('VideoSchemaDB', VideoSchema);
//    export default {User, MeetingDB};
 