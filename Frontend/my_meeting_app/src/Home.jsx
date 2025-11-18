import {React, useState} from 'react'
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { FaPlus, FaPhone, FaCalendarAlt, FaClock } from 'react-icons/fa';
import { MdFiberManualRecord } from 'react-icons/md';
import { useEffect } from 'react';

const Home = ({ setJoin }) => {

  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth0();
  const userName = user?.name || "";
  const emailId = user?.email;
  console.log(userName)

  console.log("user in home.jsx", user);

  const [meetings, setMeeting] = useState([]);

   useEffect(() => {
     
      if (isLoading || !isAuthenticated || !user) return;
     const emailId = user.email;
     
     console.log(user.email);
     const fetchMeetings = async() => {
       const response = await fetch(`https://streamapp-uyjv.onrender.com/getUserMeetings/${emailId}`);
       const data = await response.json();
       console.log("data ")
       console.log(data);
       const combined = (data.meeting || []).map((m, i) =>({
         meeting: m, 
         date: data.date[i]
       }))
 
       // console.log(combined);
       combined.sort((a, b) => a.date - b.date);

      // Get only the top 4
      const topFour = combined.slice(0, 4);

      setMeeting(topFour);       
     }
 
     fetchMeetings();
   }, [user, isAuthenticated, isLoading])
  


  // Sample upcoming meetings data
  const upcomingMeetings = [
    {
      title: "Team Sync: Sprint Planning & Updates",
      time: "10:00 AM",
      duration: "1h 30m"
    },
    {
      title: "Client Presentation Review",
      time: "2:00 PM",
      duration: "1h"
    },
    {
      title: "Product Demo with Engineering",
      time: "4:30 PM",
      duration: "45m"
    }
  ];

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
       <div className="flex gap-4 overflow-x-auto h-[90px]">
  {meetings.length > 0 ? (
    meetings.map((m, i) => (
      <div onClick={() =>window.location.href=`http://localhost:5173/meeting/${m.meeting}`}
        key={i}
        className="flex flex-col justify-center min-w-[200px] p-4 bg-slate-700 rounded-lg text-white shadow-md hover:bg-[#EA2264]"
      >
        <p className="font-semibold">{m.meeting}</p>
        <p className="text-sm text-gray-300">
          {new Date(m.date).toLocaleDateString("en-US", {
            weekday: "short", // e.g., Thu
            year: "numeric",  // 2025
            month: "short",   // Sep
            day: "numeric",   // 25
          })}
        </p>
      </div>
    ))
  ) : (
    <p className="text-gray-400">No upcoming meetings</p>
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