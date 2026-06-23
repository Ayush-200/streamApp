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
    <div className='bg-surface-dark text-text-primary min-h-screen p-4 md:p-6 lg:p-8'>
      <div className='max-w-5xl mx-auto'>
        <h1 className='text-3xl md:text-4xl font-heading font-bold text-gradient mb-8'>Schedule Meeting</h1>
        
        <div className='glass rounded-2xl p-6 md:p-8 mb-8 animate-fade-up'>
          <h2 className='text-xl md:text-2xl font-heading font-semibold text-text-primary mb-6'>Create New Schedule</h2>
          
          <form onSubmit={handleSubmit} className='space-y-5'>
            <div>
              <label className='block text-sm font-medium text-text-secondary mb-2'>
                Meeting Name <span className='text-brand-red'>*</span>
              </label>
              <input 
                type="text" 
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                placeholder='Enter meeting name'
                className='input-field'
                disabled={loading}
              />
            </div>
            
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6'>
              <div>
                <label className='block text-sm font-medium text-text-secondary mb-2'>
                  Date <span className='text-brand-red'>*</span>
                </label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className='input-field'
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className='block text-sm font-medium text-text-secondary mb-2'>
                  Time <span className='text-brand-red'>*</span>
                </label>
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className='input-field'
                  disabled={loading}
                />
              </div>
            </div>
            
            <div>
              <label className='block text-sm font-medium text-text-secondary mb-2'>
                Description <span className='text-text-muted'>(Optional)</span>
              </label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Add meeting description or notes'
                rows={3}
                maxLength={500}
                className='input-field resize-none'
                disabled={loading}
              />
              <p className='text-xs text-text-muted mt-1'>{description.length}/500 characters</p>
            </div>
            
            {error && (
              <div className='bg-brand-red/10 border border-brand-red/30 text-brand-red p-3.5 rounded-xl text-sm'>
                {error}
              </div>
            )}
            
            <button 
              type="submit"
              disabled={loading}
              className='btn-primary w-full text-center disabled:opacity-50 disabled:cursor-not-allowed text-base'
            >
              {loading ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </form>
        </div>

        <div className='glass rounded-2xl p-6 md:p-8 animate-fade-up'>
          <h2 className='text-xl md:text-2xl font-heading font-semibold text-text-primary mb-6 flex items-center'>
            <FaCalendarAlt className='mr-3 text-brand-amber' />
            Your Scheduled Meetings
          </h2>
          
          {scheduledMeetings.length > 0 ? (
            <div className='space-y-3'>
              {scheduledMeetings.map((meeting) => (
                <div 
                  key={meeting._id}
                  className='bg-surface-card rounded-xl p-5 border border-border-muted hover:border-brand-blue/40 transition-all duration-300 hover:bg-surface-hover'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-3 mb-2 flex-wrap'>
                        <h3 className='text-lg font-heading font-semibold text-text-primary truncate'>{meeting.meetingName}</h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full text-white font-medium ${getStatusColor(meeting.status)}`}>
                          {meeting.status}
                        </span>
                      </div>
                      
                      <div className='flex items-center gap-4 text-sm text-text-secondary flex-wrap'>
                        <div className='flex items-center gap-1.5'>
                          <FaCalendarAlt className='text-brand-amber text-xs' />
                          <span>{formatDate(meeting.scheduledDate)}</span>
                        </div>
                        <div className='flex items-center gap-1.5'>
                          <FaClock className='text-brand-amber text-xs' />
                          <span>{meeting.scheduledTime}</span>
                        </div>
                      </div>
                      
                      {meeting.description && (
                        <p className='text-sm text-text-muted mt-2 line-clamp-2'>{meeting.description}</p>
                      )}
                    </div>
                    
                    <div className='flex items-center gap-2 shrink-0'>
                      {meeting.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(meeting._id, 'completed')}
                            className='p-2.5 bg-brand-green/20 hover:bg-brand-green text-brand-green hover:text-white rounded-xl transition-all duration-300'
                            title='Mark as completed'
                          >
                            <FaCheck className='text-xs' />
                          </button>
                          <button
                            onClick={() => handleStatusChange(meeting._id, 'cancelled')}
                            className='p-2.5 bg-brand-orange/20 hover:bg-brand-orange text-brand-orange hover:text-white rounded-xl transition-all duration-300'
                            title='Cancel meeting'
                          >
                            <FaTimes className='text-xs' />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(meeting._id)}
                        className='p-2.5 bg-brand-red/20 hover:bg-brand-red text-brand-red hover:text-white rounded-xl transition-all duration-300'
                        title='Delete meeting'
                      >
                        <FaTrash className='text-xs' />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-16'>
              <FaCalendarAlt className='text-5xl text-border-default mx-auto mb-4' />
              <p className='text-text-secondary text-lg'>No scheduled meetings</p>
              <p className='text-text-muted text-sm mt-2'>Schedule your first meeting using the form above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleMeeting;