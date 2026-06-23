import { useState, useRef } from 'react'
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { FaPlus, FaPhone, FaCalendarAlt, FaClock, FaPlay, FaPause } from 'react-icons/fa';
import { MdFiberManualRecord } from 'react-icons/md';
import { useEffect } from 'react';
import fetchMeetings from './utils/fetchMeeting.js';
import { uploadOldestSegment } from './utils/uploadSegment.js';
import { db } from './db/db.js';
import { useProtectedApi } from './hooks/useProtectedApi.js';

const Home = ({ setJoin }) => {

  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { protectedGet } = useProtectedApi();
  const userName = user?.name || "";
  const emailId = user?.email;
  console.log(userName)

  console.log("user in home.jsx", user);

  const [meetings, setMeeting] = useState([]);
  const [nextMeeting, setNextMeeting] = useState(null);
  const [uploadingMeetings, setUploadingMeetings] = useState({});
  const uploadingMeetingsRef = useRef({});
  const meetingIdCache = useRef({});
  const currentUploadingMeeting = useRef(null);
  const runningLoops = useRef(new Set());
  const [uploadProgress, setUploadProgress] = useState({});

   useEffect(() => {
     
    if (isLoading || !isAuthenticated || !user) return;
     const emailId = user.email;
     
     console.log(user.email);
     
      const loadMeetings = async () => {
        try {
          const allMeetings = await fetchMeetings(emailId, protectedGet);
          setMeeting(allMeetings);
        } catch (error) {
          console.error("Error fetching meetings:", error);
        }
      };
      
      const loadNextMeeting = async () => {
        try {
          const response = await protectedGet(
            `${import.meta.env.VITE_BACKEND_URL}/scheduledMeetings/${emailId}`
          );
         const data = await response.json();
         const scheduledMeetings = data.meetings || [];
         
         const now = new Date();
         const upcoming = scheduledMeetings
           .filter(m => m.status === 'scheduled')
           .filter(m => {
             const meetingDateTime = new Date(`${m.scheduledDate.split('T')[0]}T${m.scheduledTime}`);
             return meetingDateTime >= now;
           })
           .sort((a, b) => {
             const dateA = new Date(`${a.scheduledDate.split('T')[0]}T${a.scheduledTime}`);
             const dateB = new Date(`${b.scheduledDate.split('T')[0]}T${b.scheduledTime}`);
             return dateA - dateB;
           });
         
         if (upcoming.length > 0) {
           const next = upcoming[0];
           const meetingDateTime = new Date(`${next.scheduledDate.split('T')[0]}T${next.scheduledTime}`);
           const timeUntil = meetingDateTime - now;
           const minutesUntil = Math.floor(timeUntil / 60000);
           const hoursUntil = Math.floor(minutesUntil / 60);
           
           setNextMeeting({
             ...next,
             meetingDateTime,
             minutesUntil,
             hoursUntil
           });
         } else {
           setNextMeeting(null);
         }
       } catch (error) {
         console.error("Error fetching next meeting:", error);
       }
     };
     
     loadMeetings();
     loadNextMeeting();
   }, [user, isAuthenticated, isLoading])
  
  // Handle upload toggle for a specific meeting
  // Fetch meetingId from meetingName
  const getMeetingIdFromName = async (meetingName) => {
    if (meetingIdCache.current[meetingName]) {
      return meetingIdCache.current[meetingName];
    }
    
    try {
      const response = await protectedGet(
        `${import.meta.env.VITE_BACKEND_URL}/getMeetingId/${encodeURIComponent(meetingName)}`
      );
      
      const data = await response.json();
      const meetingId = data.meetingId;
      
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
          await uploadOldestSegment(meetingId, emailId, getAccessTokenSilently);
          
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

            // Notify backend that all chunks are uploaded
            try {
              const token = await getAccessTokenSilently({
                authorizationParams: {
                  audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com'}/api/v2/`,
                }
              });
              await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/meeting/${meetingId}/upload-complete`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ userId: emailId })
                }
              );
            } catch (notifyError) {
              console.error("Failed to notify upload complete:", notifyError);
            }
            
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

  const formatTimeUntil = (minutesUntil, hoursUntil) => {
    if (minutesUntil < 0) return "Starting now";
    if (minutesUntil < 60) return `Starts in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`;
    if (hoursUntil < 24) return `Starts in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}`;
    const days = Math.floor(hoursUntil / 24);
    return `Starts in ${days} day${days !== 1 ? 's' : ''}`;
  };

  const formatMeetingTime = (dateTime) => {
    return dateTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatMeetingDate = (dateTime) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (dateTime.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (dateTime.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return dateTime.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  return (
    <div className='bg-surface-dark text-text-secondary min-h-screen flex flex-col'>
      <div className='flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full'>
        {/* Upcoming Meeting Header */}
        {nextMeeting ? (
          <header className='relative overflow-hidden bg-gradient-to-r from-brand-orange to-brand-amber p-6 rounded-2xl mb-8 shadow-lg shadow-brand-orange/10 animate-fade-in'>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_60%)]"></div>
            <div className='relative flex items-center justify-between flex-wrap gap-4'>
              <div>
                <div className='flex items-center gap-2 text-white/80 text-sm font-medium mb-1'>
                  <FaClock className="text-white" />
                  <span>Upcoming</span>
                </div>
                <h2 className='text-xl md:text-2xl font-heading font-bold text-white'>{nextMeeting.meetingName}</h2>
                <div className='flex items-center mt-1.5 text-white/80 text-sm'>
                  <FaCalendarAlt className='mr-2 text-white' />
                  <span>
                    {formatMeetingDate(nextMeeting.meetingDateTime)} at {formatMeetingTime(nextMeeting.meetingDateTime)}
                  </span>
                  <span className="mx-2 text-white/40">·</span>
                  <span className="text-white/90 font-medium">{formatTimeUntil(nextMeeting.minutesUntil, nextMeeting.hoursUntil)}</span>
                </div>
                {nextMeeting.description && (
                  <p className='text-white/70 text-sm mt-2 max-w-xl'>{nextMeeting.description}</p>
                )}
              </div>
              <button 
                onClick={() => navigate('/scheduleMeeting')}
                className='bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 px-5 rounded-xl transition-all duration-300 backdrop-blur-sm text-sm'
              >
                View Schedule
              </button>
            </div>
          </header>
        ) : (
          <header className='bg-surface-card/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8 animate-fade-in'>
            <div className='flex items-center justify-between flex-wrap gap-4'>
              <div>
                <h2 className='text-xl md:text-2xl font-heading font-bold text-text-primary'>No Upcoming Meetings</h2>
                <div className='flex items-center mt-1.5 text-text-muted text-sm'>
                  <FaCalendarAlt className='mr-2' />
                  <span>Schedule a meeting to see it here</span>
                </div>
              </div>
              <button 
                onClick={() => navigate('/scheduleMeeting')}
                className='bg-brand-amber hover:bg-brand-orange text-brand-navy font-semibold px-6 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(255,186,8,0.3)] active:translate-y-0 text-sm'
              >
                Schedule Meeting
              </button>
            </div>
          </header>
        )}

        <div className='mb-10 animate-fade-up'>
          <span className='text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-text-primary'>
            Hello{' '}
          </span>
          <span className='text-5xl md:text-6xl lg:text-7xl font-heading font-bold bg-gradient-to-r from-brand-amber to-brand-orange bg-clip-text text-transparent'>
            {userName.split(' ')[0]}
          </span>
        </div>

        {/* Meeting Options Grid */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10 animate-fade-up'>
          {/* Create New Meeting */}
          <button
            onClick={() => navigate('/createMeetingForm')}
            className='bg-surface-card/60 backdrop-blur-xl border border-white/10 transition-all duration-300 hover:bg-surface-hover hover:border-brand-amber/20 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] rounded-2xl p-6 flex flex-col items-start gap-4 text-left group'
          >
            <div className='p-3.5 rounded-xl bg-brand-amber/10 text-brand-amber group-hover:bg-brand-amber group-hover:text-brand-navy transition-all duration-300'>
              <FaPlus className='text-2xl' />
            </div>
            <h3 className='text-xl font-heading font-bold text-text-primary'>New Meeting</h3>
            <p className='text-sm text-text-muted'>Setup a new recording session</p>
          </button>

          {/* Join Call */}
          <button
            onClick={() => { setJoin(true); navigate(`/joinMeetingForm`) }}
            className='bg-surface-card/60 backdrop-blur-xl border border-white/10 transition-all duration-300 hover:bg-surface-hover hover:border-brand-amber/20 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] rounded-2xl p-6 flex flex-col items-start gap-4 text-left group'
          >
            <div className='p-3.5 rounded-xl bg-brand-blue/10 text-brand-blue group-hover:bg-brand-amber group-hover:text-brand-navy transition-all duration-300'>
              <FaPhone className='text-2xl' />
            </div>
            <h3 className='text-xl font-heading font-bold text-text-primary'>Join Call</h3>
            <p className='text-sm text-text-muted'>Via invitation link</p>
          </button>

          {/* Schedule Meeting */}
          <button
            onClick={() => navigate('/scheduleMeeting')}
            className='bg-surface-card/60 backdrop-blur-xl border border-white/10 transition-all duration-300 hover:bg-surface-hover hover:border-brand-amber/20 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] rounded-2xl p-6 flex flex-col items-start gap-4 text-left group'
          >
            <div className='p-3.5 rounded-xl bg-brand-amber/10 text-brand-amber group-hover:bg-brand-amber group-hover:text-brand-navy transition-all duration-300'>
              <FaCalendarAlt className='text-2xl' />
            </div>
            <h3 className='text-xl font-heading font-bold text-text-primary'>Schedule Meeting</h3>
            <p className='text-sm text-text-muted'>Plan ahead</p>
          </button>
        </div>

        {/* Your Meetings Section */}
        <div className='bg-surface-card/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 animate-fade-up'>
          <h3 className='text-xl md:text-2xl font-heading font-bold text-text-primary mb-5 flex items-center'>
            <FaCalendarAlt className='mr-3 text-brand-amber' />
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
                    className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 group relative ${
                      isThisMeetingUploading 
                        ? 'bg-surface-elevated border-brand-amber shadow-lg shadow-brand-amber/10 animate-pulse-glow' 
                        : isAnotherMeetingUploading
                        ? 'bg-surface-card border-border-muted opacity-50'
                        : 'bg-surface-card border-border-muted hover:border-brand-amber hover:bg-surface-hover hover:translate-y-[-2px] hover:shadow-lg hover:shadow-brand-amber/5 hover:ring-1 hover:ring-brand-amber/30'
                    }`}
                  >
                    <div className='flex items-start justify-between mb-3'>
                      <MdFiberManualRecord className={`mt-0.5 ${
                        isThisMeetingUploading 
                          ? 'text-brand-amber animate-pulse' 
                          : 'text-brand-blue group-hover:text-brand-amber'
                      }`} />
                      <span className='text-xs text-text-muted'>
                        {new Date(m.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className={`font-heading font-semibold mb-1 ${
                      isThisMeetingUploading 
                        ? 'text-brand-amber' 
                        : 'text-text-primary group-hover:text-brand-amber'
                    }`}>
                      {m.meeting}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(m.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    
                    {isThisMeetingUploading && (
                      <div className="absolute top-3 left-3 bg-brand-amber text-brand-navy text-xs font-bold px-2 py-1 rounded-lg">
                        UPLOADING
                      </div>
                    )}
                    
                    {/* Upload Progress Bar */}
                    {uploadProgress[m.meeting] && (
                      <div className="mt-4 mb-2">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs text-text-secondary font-medium">
                            {uploadProgress[m.meeting].status === 'uploading' && 'Uploading...'}
                            {uploadProgress[m.meeting].status === 'completed' && 'Complete'}
                            {uploadProgress[m.meeting].status === 'paused' && 'Paused'}
                            {uploadProgress[m.meeting].status === 'error' && 'Error'}
                          </span>
                          <span className="text-xs text-text-muted">
                            {uploadProgress[m.meeting].uploaded}/{uploadProgress[m.meeting].total}
                          </span>
                        </div>
                        <div className="w-full bg-border-muted rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              uploadProgress[m.meeting].status === 'completed' 
                                ? 'bg-brand-green' 
                                : uploadProgress[m.meeting].status === 'error'
                                ? 'bg-brand-red'
                                : uploadProgress[m.meeting].status === 'paused'
                                ? 'bg-text-muted'
                                : 'bg-brand-amber'
                            }`}
                            style={{ width: `${uploadProgress[m.meeting].percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-text-muted">
                            {uploadProgress[m.meeting].percentage}%
                          </span>
                          {uploadProgress[m.meeting].remaining > 0 && (
                            <span className="text-xs text-text-muted">
                              {uploadProgress[m.meeting].remaining} remaining
                            </span>
                          )}
                        </div>
                        {uploadProgress[m.meeting].error && (
                          <p className="text-xs text-brand-red mt-1">
                            {uploadProgress[m.meeting].error}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => handleUploadToggle(m.meeting, e)}
                      disabled={isAnotherMeetingUploading}
                      className={`absolute bottom-3 right-3 p-2.5 rounded-xl transition-all duration-300 ${
                        isThisMeetingUploading
                          ? 'bg-brand-red hover:bg-red-700 text-white'
                          : isAnotherMeetingUploading
                          ? 'bg-surface-elevated cursor-not-allowed opacity-50 text-text-muted'
                          : 'bg-brand-amber hover:bg-brand-orange text-brand-navy'
                      }`}
                      title={
                        isAnotherMeetingUploading 
                          ? `Switch upload to ${m.meeting}` 
                          : isThisMeetingUploading 
                          ? 'Pause Upload' 
                          : 'Upload Segments'
                      }
                    >
                      {isThisMeetingUploading ? (
                        <FaPause className='text-sm' />
                      ) : (
                        <FaPlay className='text-sm' />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='text-center py-12'>
              <FaCalendarAlt className='text-5xl text-text-muted mx-auto mb-4' />
              <p className="text-text-secondary text-lg">No meetings yet</p>
              <p className="text-text-muted text-sm mt-2">Create or schedule a meeting to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* User Footer */}
      <footer className='bg-surface-card/60 backdrop-blur-xl border border-white/10 border-t border-border-default/50'>
        <div className='max-w-7xl mx-auto p-4 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {user?.picture && (
              <img src={user.picture} alt={user?.name} className='w-8 h-8 rounded-full ring-2 ring-border-default' />
            )}
            <span className='text-text-secondary text-sm'>{user?.name || 'User'}</span>
          </div>
          <span className='text-xs text-text-muted'>StreamApp v1.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;