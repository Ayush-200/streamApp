import React from 'react'
import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useProtectedApi } from './hooks/useProtectedApi.js';
import { FaCalendarAlt, FaClock, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';

const ScheduleMeeting = () => {
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [meetingName, setMeetingName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const {isLoading, isAuthenticated, user} = useAuth0();
  const { protectedGet, protectedPost, protectedFetch } = useProtectedApi();

  const fetchScheduledMeetings = async() => {
    if (!user?.email) return;
    
    try {
      const response = await protectedGet(
        `${import.meta.env.VITE_BACKEND_URL}/scheduledMeetings/${user.email}`
      );
      const data = await response.json();
      setScheduledMeetings(data.meetings || []);
    } catch (error) {
      console.error("Error fetching scheduled meetings:", error);
    }
  };

  const handleSubmit = async(e) => {
    e.preventDefault();
    setError("");
    
    if (!meetingName.trim() || !date || !time) {
      setError("Please fill in all required fields");
      return;
    }
    
    setLoading(true);
    
    try {
      if(!user || !isAuthenticated){
        return;
      }
      
      const response = await protectedPost(
        `${import.meta.env.VITE_BACKEND_URL}/scheduleMeeting/${user.email}`,
        { 
          meetingName: meetingName.trim(), 
          scheduledDate: date,
          scheduledTime: time,
          description: description.trim()
        }
      );

      const result = await response.json();
      console.log("Meeting scheduled:", result);
      
      setMeetingName("");
      setDate("");
      setTime("");
      setDescription("");
      
      fetchScheduledMeetings();
    } catch (err) {
      console.error("Error scheduling meeting:", err);
      setError("Failed to schedule meeting. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async(meetingId) => {
    if (!confirm("Are you sure you want to delete this scheduled meeting?")) {
      return;
    }
    
    try {
      const response = await protectedFetch(
        `${import.meta.env.VITE_BACKEND_URL}/scheduledMeeting/${meetingId}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        fetchScheduledMeetings();
      }
    } catch (error) {
      console.error("Error deleting meeting:", error);
    }
  };

  const handleStatusChange = async(meetingId, newStatus) => {
    try {
      const response = await protectedFetch(
        `${import.meta.env.VITE_BACKEND_URL}/scheduledMeeting/${meetingId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        }
      );
      
      if (response.ok) {
        fetchScheduledMeetings();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    fetchScheduledMeetings();
  }, [user, isAuthenticated, isLoading]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className='bg-black text-white min-h-screen p-6'>
      <div className='max-w-6xl mx-auto'>
        <h1 className='text-4xl font-bold text-[#FFBA08] mb-8'>Schedule Meeting</h1>
        
        {/* Schedule Form */}
        <div className='bg-slate-800 rounded-xl p-6 mb-8 shadow-lg'>
          <h2 className='text-2xl font-semibold text-[#3F88C5] mb-6'>Create New Schedule</h2>
          
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-2'>
                Meeting Name *
              </label>
              <input 
                type="text" 
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                placeholder='Enter meeting name'
                className='w-full p-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-[#FFBA08] focus:outline-none'
                disabled={loading}
              />
            </div>
            
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Date *
                </label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className='w-full p-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-[#FFBA08] focus:outline-none'
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Time *
                </label>
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className='w-full p-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-[#FFBA08] focus:outline-none'
                  disabled={loading}
                />
              </div>
            </div>
            
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-2'>
                Description (Optional)
              </label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Add meeting description or notes'
                rows={3}
                maxLength={500}
                className='w-full p-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-[#FFBA08] focus:outline-none resize-none'
                disabled={loading}
              />
              <p className='text-xs text-gray-400 mt-1'>{description.length}/500 characters</p>
            </div>
            
            {error && (
              <div className='bg-red-500 bg-opacity-20 border border-red-500 text-red-300 p-3 rounded-lg'>
                {error}
              </div>
            )}
            
            <button 
              type="submit"
              disabled={loading}
              className='w-full bg-[#FFBA08] hover:bg-[#FF7A30] text-[#032B43] font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </form>
        </div>

        {/* Scheduled Meetings List */}
        <div className='bg-slate-800 rounded-xl p-6 shadow-lg'>
          <h2 className='text-2xl font-semibold text-[#3F88C5] mb-6 flex items-center'>
            <FaCalendarAlt className='mr-3 text-[#FFBA08]' />
            Your Scheduled Meetings
          </h2>
          
          {scheduledMeetings.length > 0 ? (
            <div className='space-y-4'>
              {scheduledMeetings.map((meeting) => (
                <div 
                  key={meeting._id}
                  className='bg-slate-700 rounded-lg p-5 border border-slate-600 hover:border-[#3F88C5] transition-all'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-3 mb-2'>
                        <h3 className='text-xl font-semibold text-white'>{meeting.meetingName}</h3>
                        <span className={`text-xs px-3 py-1 rounded-full text-white ${getStatusColor(meeting.status)}`}>
                          {meeting.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className='flex items-center gap-4 text-sm text-gray-300 mb-2'>
                        <div className='flex items-center gap-2'>
                          <FaCalendarAlt className='text-[#FFBA08]' />
                          <span>{formatDate(meeting.scheduledDate)}</span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <FaClock className='text-[#FFBA08]' />
                          <span>{meeting.scheduledTime}</span>
                        </div>
                      </div>
                      
                      {meeting.description && (
                        <p className='text-sm text-gray-400 mt-2'>{meeting.description}</p>
                      )}
                    </div>
                    
                    <div className='flex items-center gap-2 ml-4'>
                      {meeting.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(meeting._id, 'completed')}
                            className='p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors'
                            title='Mark as completed'
                          >
                            <FaCheck />
                          </button>
                          <button
                            onClick={() => handleStatusChange(meeting._id, 'cancelled')}
                            className='p-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors'
                            title='Cancel meeting'
                          >
                            <FaTimes />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(meeting._id)}
                        className='p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                        title='Delete meeting'
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-12'>
              <FaCalendarAlt className='text-6xl text-gray-600 mx-auto mb-4' />
              <p className='text-gray-400 text-lg'>No scheduled meetings</p>
              <p className='text-gray-500 text-sm mt-2'>Schedule your first meeting using the form above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleMeeting;