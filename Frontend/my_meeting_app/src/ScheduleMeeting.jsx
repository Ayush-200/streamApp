import React from 'react'
import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';


const ScheduleMeeting = () => {
  // const emailId = user.email;
  const [meetings, setMeeting] = useState([]);
  const [meetingName, setMeetingName] = useState("");
  const [date, setDate] = useState("");
  const {isLoading, isAuthenticated, user} = useAuth0();


  //   const fetchMeetings = async() => {
  //     if (isLoading || !isAuthenticated || !user) return;
  //   const emailId = user.email;
  //   const response = await fetch(`https://streamapp-uyjv.onrender.com/getUserMeetings/${emailId}`);
  //   const data = await response.json();
  //   console.log("data ")
  //   console.log(data);
  //   const combined = (data.meeting || []).map((m, i) =>({
  //     meeting: m, 
  //     date: data.date[i]
  //   }))

  //   // console.log(combined);
  //   setMeeting(combined);
    
  // }
  const handleSubmit = async(e) =>{
    e.preventDefault();

    
    try {
      if(!user || !isAuthenticated){
        return;
      }
      const emailId = user.email;
      const response = await fetch(`https://streamapp-uyjv.onrender.com/addUsersMeetings/${emailId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newMeeting: meetingName, newDate: date }), // send selected date and meeting name
      });

      const result = await response.json();
      console.log("Server response:", result);
    } catch (err) {
      console.error("Error submitting meeting:", err);
    }
    
    fetchMeetings();

  }

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
      setMeeting(combined);
      
    }

    fetchMeetings();
  }, [user, isAuthenticated, isLoading])
  
  
  return (
    <> 
    {(meetings.length == 0) ? (
      <div>no meetings found</div>):
      (
        (meetings || []).map((m, index) =>(
          <div key={index}> 
          <div>{ m.meeting }</div>
          <div>{ m.date }</div>
          </div>
        ))
    )
}

    <div>
      <form onSubmit={handleSubmit} className='flex flex-col gap-5 w-60 bg-red-300 p-5'>
        <input type="text" placeholder='enter meeting name to add' onChange={(e) =>{setMeetingName(e.target.value)}}/>
        <input type="date" className='border-red-400' onChange={(e) =>{setDate(e.target.value)}}/>
        <input type="submit" placeholder='add Meeting'/>
      </form>
    </div>
    </>
  )
}

export default ScheduleMeeting