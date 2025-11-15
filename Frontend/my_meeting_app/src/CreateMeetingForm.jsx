import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react';

const CreateMeetingForm = () => {
    const navigate = useNavigate();
      const [meetingName, setMeetingName] = useState("");

       const handleSubmit = async () => {
    if (meetingName.trim()) {
      const trimMeetingName  = meetingName.trim();
      const response = await fetch(`http://localhost:3000/getAlreadyCreatedMeeting/${trimMeetingName}`);
      const exists = await response.json();
      console.log("exists  ", exists);
      if(!exists){
        await fetch(`http://localhost:3000/addMeetingName/${trimMeetingName}`)
        navigate(`/meeting/${encodeURIComponent(meetingName)}`);
      }
      else{
        alert("meeting already exists");
      }
      
    }
  };
  return (
    <div>
        <input type="text" placeholder='enter the meeting Name' onChange={(e) => setMeetingName(e.target.value)}/>
        <button  className = 'bg-amber-600 p-5 ' onClick = {() => handleSubmit()}>Submit</button>
    </div>
  )
}

export default CreateMeetingForm;