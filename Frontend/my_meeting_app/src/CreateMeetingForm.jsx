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
      <div className='bg-white/8 backdrop-blur-xl border-2 border-brand-amber/30 shadow-[0_8px_32px_rgba(255,186,8,0.08)] rounded-2xl p-8 w-full max-w-md animate-fade-up'>
        <h2 className='text-2xl font-heading font-bold text-white mb-6'>Create Meeting</h2>
        <input
          type="text"
          placeholder='Enter meeting name'
          value={meetingName}
          onChange={(e) => setMeetingName(e.target.value)}
          className='w-full px-4 py-3 rounded-xl bg-surface-elevated text-white border-2 border-brand-amber/30 outline-none transition-all duration-300 placeholder:text-[#cbd5e1] focus:border-brand-amber focus:shadow-[0_0_0_3px_rgba(255,186,8,0.15)] mb-4'
        />
        <button
          className='bg-brand-amber hover:bg-brand-orange text-brand-navy font-semibold px-6 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(255,186,8,0.3)] active:translate-y-0 w-full text-center'
          onClick={() => createMeeting(meetingName, navigate, user?.email, { protectedGet, protectedPost })}
        >
          Create Meeting
        </button>
      </div>
    </div>
  )
}

export default CreateMeetingForm;