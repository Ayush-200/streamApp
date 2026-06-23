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
    <div className='flex items-center justify-center min-h-screen bg-surface-dark p-4'>
      <div className='glass rounded-2xl p-8 w-full max-w-md animate-fade-up'>
        <h2 className='text-2xl font-heading font-bold text-text-primary mb-6'>Create Meeting</h2>
        <input
          type="text"
          placeholder='Enter meeting name'
          value={meetingName}
          onChange={(e) => setMeetingName(e.target.value)}
          className='input-field mb-4'
        />
        <button
          className='btn-primary w-full text-center'
          onClick={() => createMeeting(meetingName, navigate, user?.email, { protectedGet, protectedPost })}
        >
          Create Meeting
        </button>
      </div>
    </div>
  )
}

export default CreateMeetingForm;