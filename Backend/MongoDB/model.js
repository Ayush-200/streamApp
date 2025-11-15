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

   export const User = mongoose.model('User', userSchema);
   export const MeetingDB = mongoose.model('MeetingDB', meetingSchema);
//    export default {User, MeetingDB};
 