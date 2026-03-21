import {React, useState, useRef} from 'react'
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { FaPlus, FaPhone, FaCalendarAlt, FaClock, FaPlay, FaPause } from 'react-icons/fa';
import { MdFiberManualRecord } from 'react-icons/md';
import { useEffect } from 'react';
import fetchMeetings from './utils/fetchMeeting.js';
import { uploadOldestSegment, isUploadInProgress } from './utils/uploadSegment.js';

const Home = ({ setJoin }) => {

  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth0();
  const userName = user?.name || "";
  const emailId = user?.email;
  console.log(userName)

  console.log("user in home.jsx", user);

  const [meetings, setMeeting] = useState([]);
  const [uploadingMeetings, setUploadingMeetings] = useState({}); // Track upload state per meeting
  const uploadingMeetingsRef = useRef({}); // Use ref to track current state in async functions
  const meetingIdCache = useRef({}); // Cache meetingId lookups

   useEffect(() => {
     
    if (isLoading || !isAuthenticated || !user) return;
     const emailId = user.email;
     
     console.log(user.email);
     
     const loadMeetings = async () => {
       try {
         const allMeetings = await fetchMeetings(emailId);
         setMeeting(allMeetings);
       } catch (error) {
         console.error("Error fetching meetings:", error);
       }
     };
     
     loadMeetings();
   }, [user, isAuthenticated, isLoading])
  
  // Handle upload toggle for a specific meeting
  // Fetch meetingId from meetingName
  const getMeetingIdFromName = async (meetingName) => {
    // Check cache first
    if (meetingIdCache.current[meetingName]) {
      return meetingIdCache.current[meetingName];
    }
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/getMeetingId/${encodeURIComponent(meetingName)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch meetingId for ${meetingName}`);
      }
      
      const data = await response.json();
      const meetingId = data.meetingId;
      
      // Cache the result
      meetingIdCache.current[meetingName] = meetingId;
      
      return meetingId;
    } catch (error) {
      console.error(`Error fetching meetingId for ${meetingName}:`, error);
      throw error;
    }
  };

  const handleUploadToggle = async (meetingName, e) => {
    e.stopPropagation(); // Prevent navigation when clicking the button
    
    const isCurrentlyUploading = uploadingMeetingsRef.current[meetingName];
    
    if (isCurrentlyUploading) {
      // Pause upload
      uploadingMeetingsRef.current[meetingName] = false;
      setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
      console.log(`⏸️ Paused upload for meeting: ${meetingName}`);
    } else {
      // Start/Resume upload
      uploadingMeetingsRef.current[meetingName] = true;
      setUploadingMeetings(prev => ({ ...prev, [meetingName]: true }));
      console.log(`▶️ Starting upload for meeting: ${meetingName}`);
      
      // Fetch meetingId and start upload loop
      try {
        const meetingId = await getMeetingIdFromName(meetingName);
        console.log(`Fetched meetingId: ${meetingId} for meeting: ${meetingName}`);
        startUploadLoop(meetingName, meetingId);
      } catch (error) {
        console.error(`Failed to start upload for ${meetingName}:`, error);
        uploadingMeetingsRef.current[meetingName] = false;
        setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
        alert(`Failed to start upload: ${error.message}`);
      }
    }
  };
  
  // Continuous upload loop for a meeting
  const startUploadLoop = async (meetingName, meetingId) => {
    console.log("hey start upload loop")
    console.log("Upload state:", uploadingMeetingsRef.current[meetingName])
    console.log("Using meetingId:", meetingId)
    
    while (uploadingMeetingsRef.current[meetingName]) {
      console.log("inside while loop", meetingId);
      try {
        await uploadOldestSegment(meetingId, emailId); // Use meetingId instead of meetingName
        
        // Check if there are more segments to upload
        if (!isUploadInProgress()) {
          // No more segments, stop uploading
          uploadingMeetingsRef.current[meetingName] = false;
          setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
          console.log(`✅ All segments uploaded for meeting: ${meetingName}`);
          break;
        }
        
        // Wait a bit before next upload
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error uploading segment for ${meetingName}:`, error);
        uploadingMeetingsRef.current[meetingName] = false;
        setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
        break;
      }
    }
  };


  // Sample upcoming meetings data (unused, can be removed)
  // const upcomingMeetings = [...]

  return (
    <div className='bg-black text-[#3F88C5] min-h-screen flex flex-col'>
      {/* Main Content */}
      <div className='flex-1 p-6'>
        {/* Upcoming Meeting Header */}
        <header className='bg-[#FF7A30] p-5 rounded-xl mb-8 shadow-lg'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-2xl font-semibold text-white'>Next Meeting: Daily Standup</h2>
              <div className='flex items-center mt-2 text-[#FFBA08]'>
                <FaClock className='mr-2' />
                <span>Starts in 15 minutes (12:30 PM)</span>
              </div>
            </div>
            <button className='bg-[#FFBA08] hover:bg-[#D00000] text-[#032B43] font-medium py-2 px-4 rounded-lg transition-colors'>
              Join Now
            </button>
          </div>
        </header>

        <div className='text-8xl mb-11'>Hello { userName }</div>

        {/* Meeting Options Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10'>
          {/* Create New Meeting */}
          <button
            onClick={() => navigate('/createMeetingForm')}
            className='bg-slate-600 border border-slate-300 rounded-xl p-6 flex flex-col items-start gap-4 text-left transition-all duration-300 hover:bg-[#3F88C5] hover:scale-[1.02] group'
          >
            <div className='p-3 rounded-lg bg-[#33415c] group-hover:bg-[#FFBA08] group-hover:text-[#032B43]'>
              <FaPlus className='text-2xl' />
            </div>
            <h3 className='text-xl font-bold text-white'>New Meeting</h3>
            <p className='text-sm text-[#FFBA08]'>Setup a new recording</p>
          </button>

          {/* Join Call */}
          <button
            onClick={() => { setJoin(true); navigate(`/joinMeetingForm`) }}
            className='bg-slate-600 border border-[#3F88C5] rounded-xl p-6 flex flex-col items-start gap-4 text-left transition-all duration-300 hover:bg-[#3F88C5] hover:scale-[1.02] group'
          >
            <div className='p-3 rounded-lg bg-[#33415c] group-hover:bg-[#FFBA08] group-hover:text-[#032B43]'>
              <FaPhone className='text-2xl' />
            </div>
            <h3 className='text-xl font-bold text-white'>Join Call</h3>
            <p className='text-sm text-[#FFBA08]'>via invitation link</p>
          </button>

          {/* Schedule Meeting */}
          <button
            onClick={() => navigate('/scheduleMeeting')}
            className='bg-slate-600 border border-[#3F88C5] rounded-xl p-6 flex flex-col items-start gap-4 text-left transition-all duration-300 hover:bg-[#3F88C5] hover:scale-[1.02] group'
          >
            <div className='p-3 rounded-lg bg-[#33415c] group-hover:bg-[#FFBA08] group-hover:text-[#032B43]'>
              <FaCalendarAlt className='text-2xl' />
            </div>
            <h3 className='text-xl font-bold text-white'>Schedule Meeting</h3>
            <p className='text-sm text-[#FFBA08]'>Plan your meeting</p>
          </button>

          
        </div>

        {/* Upcoming Meetings Section */}
        <div className='bg-slate-800 rounded-xl p-6 shadow-lg'>
          <h3 className='text-2xl font-bold text-white mb-4 flex items-center'>
            <FaCalendarAlt className='mr-3 text-[#FFBA08]' />
            Your Meetings
          </h3>
          
          {meetings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {meetings.map((m, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/meeting/${m.meeting}`)}
                  className="cursor-pointer p-4 bg-slate-700 rounded-lg border border-slate-600 hover:border-[#FFBA08] hover:bg-slate-600 transition-all duration-300 group relative"
                >
                  <div className='flex items-start justify-between mb-2'>
                    <MdFiberManualRecord className='text-[#3F88C5] group-hover:text-[#FFBA08] mt-1' />
                    <span className='text-xs text-gray-400'>
                      {new Date(m.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="font-semibold text-white group-hover:text-[#FFBA08] mb-1">
                    {m.meeting}
                  </p>
                  <p className="text-sm text-gray-400 mb-3">
                    {new Date(m.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  
                  {/* Upload Segment Button */}
                  <button
                    onClick={(e) => handleUploadToggle(m.meeting, e)}
                    className={`absolute bottom-3 right-3 p-2 rounded-full transition-all duration-300 ${
                      uploadingMeetings[m.meeting]
                        ? 'bg-[#D00000] hover:bg-red-700'
                        : 'bg-[#FFBA08] hover:bg-[#FF7A30]'
                    }`}
                    title={uploadingMeetings[m.meeting] ? 'Pause Upload' : 'Upload Segments'}
                  >
                    {uploadingMeetings[m.meeting] ? (
                      <FaPause className='text-white text-sm' />
                    ) : (
                      <FaPlay className='text-[#032B43] text-sm' />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-8'>
              <p className="text-gray-400 text-lg">No upcoming meetings</p>
              <p className="text-gray-500 text-sm mt-2">Create or schedule a meeting to get started</p>
            </div>
          )}
        </div>

      </div>

      {/* User Footer */}
      <footer className='bg-[#032B43] p-4 border-t border-[#3F88C5]'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            {user?.picture && (
              <img src={user.picture} alt={user?.name} className='w-8 h-8 rounded-full mr-3' />
            )}
            <span className='text-[#3F88C5]'>{user?.name || 'User'}</span>
          </div>
          <span className='text-sm text-[#3F88C5]'>Meeting Assistant v1.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;