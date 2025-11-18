import { MeetingParticipantDB } from "../MongoDB/model.js"

const increaseMeetingParticipants = async(meetingId) => {
    // console.log("meetingParticipantDB", MeetingParticipantDB);
    try{
        const updatedDoc = await MeetingParticipantDB.findOneAndUpdate(
            {meetingId: meetingId}, 
            {$inc: {participantCount: 1}}, 
            {new: true}
        );
        // console.log("count updated", updatedDoc);
        return updatedDoc
    }
    catch(err){
        console.log("error occured in increasing MeetingParticipantDB count", err);
    }
}

export default increaseMeetingParticipants;