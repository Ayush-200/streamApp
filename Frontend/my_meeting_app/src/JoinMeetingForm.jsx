import React, { useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom";
const JoinMeetingForm = () => {
    const [ meetingName, setMeetingName ] = useState("")
    const navigate = useNavigate();
  return (
    <div>
        <input type="text" placeholder='enter the meeting name' onChange={(e) => setMeetingName(e.target.value)}/>
        <button onClick={() =>navigate(`/meeting/${encodeURIComponent(meetingName)}`)}>submit</button>
    </div>
  )
}

export default JoinMeetingForm