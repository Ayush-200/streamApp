const createMeeting = async (meetingName, navigate) => {
    if (meetingName.trim()) {
      const trimMeetingName = meetingName.trim();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/getAlreadyCreatedMeeting/${trimMeetingName}`);
      const exists = await response.json();
      console.log("exists  ", exists);
      if(!exists){
        const createResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/addMeetingName/${trimMeetingName}`);
        const data = await createResponse.json();
        
        // Navigate using meetingId instead of meetingName
        navigate(`/meeting/${data.meetingId}`);
      }
      else{
        alert("meeting already exists");
      }
    }
  };

  export default createMeeting;