const createMeeting = async (meetingName, navigate, userEmail) => {
    if (meetingName.trim()) {
      const trimMeetingName = meetingName.trim();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/getAlreadyCreatedMeeting/${trimMeetingName}`);
      const exists = await response.json();
      console.log("exists  ", exists);
      if(!exists){
        const createResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/addMeetingName/${trimMeetingName}`);
        const data = await createResponse.json();
        
        // Save meeting to user's database
        if (userEmail) {
          try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/addUsersMeetings/${userEmail}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                newMeeting: trimMeetingName,
                newDate: new Date()
              })
            });
            console.log("Meeting saved to user's dashboard");
          } catch (error) {
            console.error("Error saving meeting to user:", error);
          }
        }
        
        // Navigate using meetingId instead of meetingName
        navigate(`/meeting/${data.meetingId}`);
      }
      else{
        alert("meeting already exists");
      }
    }
  };

  export default createMeeting;