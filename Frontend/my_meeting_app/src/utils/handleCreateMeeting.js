
    const createMeeting = async (meetingName, navigate) => {
    if (meetingName.trim()) {
      const trimMeetingName  = meetingName.trim();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/getAlreadyCreatedMeeting/${trimMeetingName}`);
      const exists = await response.json();
      console.log("exists  ", exists);
      if(!exists){
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/addMeetingName/${trimMeetingName}`)
        navigate(`/meeting/${encodeURIComponent(meetingName)}`);
      }
      else{
        alert("meeting already exists");
      }
      
    }
  };

  export default createMeeting;