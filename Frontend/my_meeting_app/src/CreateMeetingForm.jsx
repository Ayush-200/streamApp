import React from 'react'

import { useState } from 'react';
import createMeeting from './utils/handleCreateMeeting.js';
  import { useNavigate } from 'react-router-dom'
const CreateMeetingForm = () => {
      const navigate = useNavigate();
    const [meetingName, setMeetingName] = useState("");


  return (
    <div>
        <input type="text" placeholder='enter the meeting Name' onChange={(e) => setMeetingName(e.target.value)}/>
        <button  className = 'bg-amber-600 p-5 ' onClick = {() => createMeeting(meetingName, navigate)}>Submit</button>
    </div>
  )
}

export default CreateMeetingForm;