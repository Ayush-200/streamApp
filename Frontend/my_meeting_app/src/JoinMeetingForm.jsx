import React, { useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useProtectedApi } from './hooks/useProtectedApi.js';

const JoinMeetingForm = () => {
    const [ meetingName, setMeetingName ] = useState("")
    const [ error, setError ] = useState("")
    const [ loading, setLoading ] = useState(false)
    const navigate = useNavigate();
    const { user } = useAuth0();
    const { protectedGet, protectedPost } = useProtectedApi();
    
    const handleJoinMeeting = async () => {
      if (!meetingName.trim()) {
        setError("Please enter a meeting name");
        return;
      }
      
      setLoading(true);
      setError("");
      
      const trimMeetingName = meetingName.trim();
      
      try {
        const response = await protectedGet(
          `${import.meta.env.VITE_BACKEND_URL}/getMeetingId/${encodeURIComponent(trimMeetingName)}`
        );
        
        const data = await response.json();
        const meetingId = data.meetingId;
        
        console.log("Joining meeting with ID:", meetingId);
        
        if (user?.email) {
          try {
            await protectedPost(
              `${import.meta.env.VITE_BACKEND_URL}/addUsersMeetings/${user.email}`,
              { newMeeting: trimMeetingName, newDate: new Date() }
            );
          } catch (error) {
            console.error("Error saving meeting to user:", error);
          }
        }
        
        navigate(`/meeting/${meetingId}`);
        
      } catch (error) {
        console.error("Error joining meeting:", error);
        if (error.message.includes('404')) {
          setError("Meeting not found. Please check the meeting name.");
        } else if (error.message.includes('401')) {
          setError("Authentication failed. Please log in again.");
        } else {
          setError("An error occurred. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };
    
  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-black'>
      <div className='bg-slate-800 p-8 rounded-xl shadow-lg w-96'>
        <h2 className='text-2xl font-bold text-white mb-6'>Join Meeting</h2>
        
        <input 
          type="text" 
          placeholder='Enter the meeting name' 
          value={meetingName}
          onChange={(e) => {
            setMeetingName(e.target.value);
            setError("");
          }}
          className='w-full p-3 mb-4 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-[#FFBA08] focus:outline-none'
          disabled={loading}
        />
        
        {error && (
          <p className='text-red-500 text-sm mb-4'>{error}</p>
        )}
        
        <button 
          onClick={handleJoinMeeting}
          disabled={loading}
          className='w-full bg-[#FFBA08] hover:bg-[#FF7A30] text-[#032B43] font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Joining...' : 'Join Meeting'}
        </button>
      </div>
    </div>
  )
}

export default JoinMeetingForm