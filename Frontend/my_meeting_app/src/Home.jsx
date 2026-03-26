import { useState, useRef } from 'react'
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { FaPlus, FaPhone, FaCalendarAlt, FaClock, FaPlay, FaPause } from 'react-icons/fa';
import { MdFiberManualRecord } from 'react-icons/md';
import { useEffect } from 'react';
import fetchMeetings from './utils/fetchMeeting.js';
import { uploadOldestSegment } from './utils/uploadSegment.js';
import { db } from './db/db.js';

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
  const currentUploadingMeeting = useRef(null); // Track which meeting is currently uploading
  const runningLoops = useRef(new Set()); // Track which loops are actually running
  const [uploadProgress, setUploadProgress] = useState({}); // Track upload progress per meeting

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
    e.stopPropagation();
    
    const isCurrentlyUploading = uploadingMeetingsRef.current[meetingName];
    
    if (isCurrentlyUploading) {
      // Pause upload
      uploadingMeetingsRef.current[meetingName] = false;
      setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
      currentUploadingMeeting.current = null;
      console.log(`⏸️ Upload paused: ${meetingName}`);
    } else {
      // Check if another meeting is uploading
      if (currentUploadingMeeting.current && currentUploadingMeeting.current !== meetingName) {
        const previousMeeting = currentUploadingMeeting.current;
        console.log(`🔄 Switching upload: ${previousMeeting} → ${meetingName}`);
        
        // Stop previous upload
        uploadingMeetingsRef.current[previousMeeting] = false;
        setUploadingMeetings(prev => ({ ...prev, [previousMeeting]: false }));
      }
      
      // Prevent duplicate loops
      if (runningLoops.current.has(meetingName)) {
        return;
      }
      
      runningLoops.current.add(meetingName);
      
      // Start upload
      uploadingMeetingsRef.current[meetingName] = true;
      setUploadingMeetings(prev => ({ ...prev, [meetingName]: true }));
      currentUploadingMeeting.current = meetingName;
      console.log(`▶️ Upload started: ${meetingName}`);
      
      try {
        const meetingId = await getMeetingIdFromName(meetingName);
        await startUploadLoop(meetingName, meetingId);
      } catch (error) {
        console.error(`Upload start failed:`, error);
        uploadingMeetingsRef.current[meetingName] = false;
        setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
        currentUploadingMeeting.current = null;
        runningLoops.current.delete(meetingName);
        alert(`Failed to start upload: ${error.message}`);
      }
    }
  };
  
  // Continuous upload loop for a meeting
  const startUploadLoop = async (meetingName, meetingId) => {
    try {
      // Get initial count
      const initialCount = await db.chunks
        .where('meetingId')
        .equals(meetingId)
        .count();
      
      console.log(`📊 Upload starting: ${initialCount} segments for ${meetingName}`);
      
      while (uploadingMeetingsRef.current[meetingName]) {
        try {
          // Get current segment count
          const beforeCount = await db.chunks
            .where('meetingId')
            .equals(meetingId)
            .count();
          
          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            [meetingName]: {
              total: initialCount,
              remaining: beforeCount,
              uploaded: initialCount - beforeCount,
              percentage: initialCount > 0 ? Math.round(((initialCount - beforeCount) / initialCount) * 100) : 0,
              status: 'uploading'
            }
          }));
          
          // Upload segments (up to 3 in parallel)
          await uploadOldestSegment(meetingId, emailId);
          
          // Check if done
          const afterCount = await db.chunks
            .where('meetingId')
            .equals(meetingId)
            .count();
          
          if (afterCount === 0) {
            // Upload complete
            uploadingMeetingsRef.current[meetingName] = false;
            setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
            
            setUploadProgress(prev => ({
              ...prev,
              [meetingName]: {
                total: initialCount,
                remaining: 0,
                uploaded: initialCount,
                percentage: 100,
                status: 'completed'
              }
            }));
            
            console.log(`✅ Upload complete: ${meetingName} (${initialCount} segments)`);
            
            // Clear progress after 3 seconds
            setTimeout(() => {
              setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[meetingName];
                return newProgress;
              });
            }, 3000);
            
            break;
          }
          
          // Wait before next batch
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Upload error for ${meetingName}:`, error);
          
          setUploadProgress(prev => ({
            ...prev,
            [meetingName]: {
              ...prev[meetingName],
              status: 'error',
              error: error.message
            }
          }));
          
          uploadingMeetingsRef.current[meetingName] = false;
          setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
          break;
        }
      }
      
      // Handle pause
      if (!uploadingMeetingsRef.current[meetingName]) {
        const remainingCount = await db.chunks
          .where('meetingId')
          .equals(meetingId)
          .count();
        
        if (remainingCount > 0) {
          setUploadProgress(prev => ({
            ...prev,
            [meetingName]: {
              ...prev[meetingName],
              status: 'paused'
            }
          }));
        }
      }
      
    } finally {
      runningLoops.current.delete(meetingName);
      
      if (currentUploadingMeeting.current === meetingName) {
        currentUploadingMeeting.current = null;
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
              {meetings.map((m, i) => {
                const isThisMeetingUploading = uploadingMeetings[m.meeting];
                const isAnotherMeetingUploading = currentUploadingMeeting.current && currentUploadingMeeting.current !== m.meeting;
                
                return (
                  <div
                    key={i}
                    onClick={() => navigate(`/meeting/${m.meeting}`)}
                    className={`cursor-pointer p-4 bg-slate-700 rounded-lg border transition-all duration-300 group relative ${
                      isThisMeetingUploading 
                        ? 'border-[#FFBA08] ring-2 ring-[#FFBA08] ring-opacity-50' 
                        : isAnotherMeetingUploading
                        ? 'border-slate-600 opacity-60'
                        : 'border-slate-600 hover:border-[#FFBA08] hover:bg-slate-600'
                    }`}
                  >
                    <div className='flex items-start justify-between mb-2'>
                      <MdFiberManualRecord className={`mt-1 ${
                        isThisMeetingUploading 
                          ? 'text-[#FFBA08] animate-pulse' 
                          : 'text-[#3F88C5] group-hover:text-[#FFBA08]'
                      }`} />
                      <span className='text-xs text-gray-400'>
                        {new Date(m.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className={`font-semibold mb-1 ${
                      isThisMeetingUploading 
                        ? 'text-[#FFBA08]' 
                        : 'text-white group-hover:text-[#FFBA08]'
                    }`}>
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
                    
                    {/* Upload status indicator */}
                    {isThisMeetingUploading && (
                      <div className="absolute top-3 left-3 bg-[#FFBA08] text-[#032B43] text-xs font-bold px-2 py-1 rounded">
                        UPLOADING
                      </div>
                    )}
                    
                    {/* Upload Progress Bar */}
                    {uploadProgress[m.meeting] && (
                      <div className="mt-3 mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-300 font-medium">
                            {uploadProgress[m.meeting].status === 'uploading' && '⏳ Uploading...'}
                            {uploadProgress[m.meeting].status === 'completed' && '✅ Complete!'}
                            {uploadProgress[m.meeting].status === 'paused' && '⏸️ Paused'}
                            {uploadProgress[m.meeting].status === 'error' && '❌ Error'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {uploadProgress[m.meeting].uploaded}/{uploadProgress[m.meeting].total}
                          </span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              uploadProgress[m.meeting].status === 'completed' 
                                ? 'bg-green-500' 
                                : uploadProgress[m.meeting].status === 'error'
                                ? 'bg-red-500'
                                : uploadProgress[m.meeting].status === 'paused'
                                ? 'bg-gray-400'
                                : 'bg-[#FFBA08]'
                            }`}
                            style={{ width: `${uploadProgress[m.meeting].percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-400">
                            {uploadProgress[m.meeting].percentage}%
                          </span>
                          {uploadProgress[m.meeting].remaining > 0 && (
                            <span className="text-xs text-gray-400">
                              {uploadProgress[m.meeting].remaining} remaining
                            </span>
                          )}
                        </div>
                        {uploadProgress[m.meeting].error && (
                          <p className="text-xs text-red-400 mt-1">
                            {uploadProgress[m.meeting].error}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Upload Segment Button */}
                    <button
                      onClick={(e) => handleUploadToggle(m.meeting, e)}
                      disabled={isAnotherMeetingUploading}
                      className={`absolute bottom-3 right-3 p-2 rounded-full transition-all duration-300 ${
                        isThisMeetingUploading
                          ? 'bg-[#D00000] hover:bg-red-700'
                          : isAnotherMeetingUploading
                          ? 'bg-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-[#FFBA08] hover:bg-[#FF7A30]'
                      }`}
                      title={
                        isAnotherMeetingUploading 
                          ? `Another meeting is uploading. Click to switch to ${m.meeting}` 
                          : isThisMeetingUploading 
                          ? 'Pause Upload' 
                          : 'Upload Segments'
                      }
                    >
                      {isThisMeetingUploading ? (
                        <FaPause className='text-white text-sm' />
                      ) : (
                        <FaPlay className='text-[#032B43] text-sm' />
                      )}
                    </button>
                  </div>
                );
              })}
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