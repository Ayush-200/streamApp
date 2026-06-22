import React from 'react'

import { useState } from 'react';
import createMeeting from './utils/handleCreateMeeting.js';
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from "@auth0/auth0-react";
import { useProtectedApi } from './hooks/useProtectedApi.js';

const CreateMeetingForm = () => {
      const navigate = useNavigate();
      const { user } = useAuth0();
      const { protectedGet, protectedPost } = useProtectedApi();
      const [meetingName, setMeetingName] = useState("");


  return (
    <div>
        <input type="text" placeholder='enter the meeting Name' onChange={(e) => setMeetingName(e.target.value)}/>
        <button  className = 'bg-amber-600 p-5 ' onClick = {() => createMeeting(meetingName, navigate, user?.email, { protectedGet, protectedPost })}>Submit</button>
    </div>
  )
}

export default CreateMeetingForm;