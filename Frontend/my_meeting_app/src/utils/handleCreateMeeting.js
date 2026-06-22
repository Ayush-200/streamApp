const createMeeting = async (meetingName, navigate, userEmail, { protectedGet, protectedPost }) => {
    if (meetingName.trim()) {
      const trimMeetingName = meetingName.trim();
      const response = await protectedGet(
        `${import.meta.env.VITE_BACKEND_URL}/getAlreadyCreatedMeeting/${trimMeetingName}`
      );
      const exists = await response.json();
      
      if(!exists){
        const createResponse = await protectedGet(
          `${import.meta.env.VITE_BACKEND_URL}/addMeetingName/${trimMeetingName}`
        );
        const data = await createResponse.json();
        
        if (userEmail) {
          try {
            await protectedPost(
              `${import.meta.env.VITE_BACKEND_URL}/addUsersMeetings/${userEmail}`,
              { newMeeting: trimMeetingName, newDate: new Date() }
            );
          } catch (error) {
            console.error("Error saving meeting to user:", error);
          }
        }
        
        navigate(`/meeting/${data.meetingId}`);
      }
      else{
        alert("meeting already exists");
      }
    }
  };

  export default createMeeting;