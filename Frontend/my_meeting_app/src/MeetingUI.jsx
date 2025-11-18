  // MeetingUI.jsx
  import "@stream-io/video-react-sdk/dist/css/styles.css";
  import {
    StreamCall,
    StreamTheme,
    StreamVideo,
    StreamVideoClient,
    SpeakerLayout,
    CallControls,
    CallParticipantsList,
    PaginatedGridLayout
  } from "@stream-io/video-react-sdk";

  import { useEffect, useState } from "react";
  import { useParams } from "react-router-dom";
  import  socket  from './socket.js';
  import { useAuth0 } from "@auth0/auth0-react";
  import {startRecording, stopRecording, cleanupRecording, isRecordingActive } from './recording.js';
  const apiKey = "55gcbd3wd3nk";

  const MeetingUI = ({ showParticipantList, setShowParticipantList, join, setJoin }) => {
    const [client, setClient] = useState(null);
    const [recording, setRecording] = useState(false);
    const [call, setCall] = useState(null);
    const { meetingName } = useParams();
    const { user, isLoading, isAuthenticated } = useAuth0();

    const handleSubmit = () => {
      setShowParticipantList(!showParticipantList);
    };

    function handleRecord(){
      console.log("record button clicked");
      console.log(socket.id);
      if(!recording){
        console.log("inside recirding if block");
        socket.emit("start_recording", meetingName);
        setRecording(true);
      }
      else{
        console.log("inside else part");
        socket.emit("stop_recording", meetingName);
        setRecording(false);
      }
    }


    useEffect(() => {

      if( isLoading || !isAuthenticated ) {
        return;
      }
      const init = async () => {
        try{
      
        let userId = user.email.replace(/[@.]/g, "_");
        // replace with dynamic id if needed
        const response = await fetch(`https://streamapp-uyjv.onrender.com/token/${userId}`);
        const { token } = await response.json();

        const userObj = { id: userId , name: user.name};
        console.log("userObj", userObj);
        const c = new StreamVideoClient({ apiKey, user:userObj, token });
        const callInstance = c.call("default", `${meetingName || "test-room"}`);

        
        if(join){
          await callInstance.join({
          create: true,
          permissions: [
            "send-audio",
            "send-video",
            "send-screen-share",
            "receive-audio",
            "receive-video",
            "receive-screen-share",
          ],
        });
        }
        else{
          await callInstance.getOrCreate({
            permissions: [
              "send-audio",
              "send-video",
              "send-screen-share",
              "receive-audio",
              "receive-video",
              "receive-screen-share",
            ],
          });
        }

        setClient(c);
        setCall(callInstance);
      }catch(error){
        console.log("error occurred in meetingUI.jsx", error);
      }
      };

      init();
    }, [isLoading, isAuthenticated, user, join, meetingName]);
    
    useEffect(() => {
      if (!call || !user) return;
      console.log("under useEffect ");
      console.log("meeting name", meetingName)
      console.log(recording);
      

      socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});

    

      socket.on("start_recording", () =>{
        console.log("start_recording socket endpoint hitted");
        setRecording(true);
        startRecording(meetingName, user?.email);
      });

      socket.on("stop_recording", () =>{
        console.log("recoding stopped endpoint hitted");
        stopRecording(meetingName);
        
      })

      socket.on("download_ready", ({url}) =>{
      console.log("download ready at: ", url);
      window.location.href = `https://streamapp-uyjv.onrender.com${url}`;
      })
      
      socket.on("joined_meeting", (meetingId) => {
    
        console.log("Joined room:", meetingId);
      });

      return () => {
        socket.off("start_recording");
        socket.off("stop_recording");
        socket.off("join_meeting");
        socket.off("ready_to_download");
      };
    }, [call, meetingName, user]);

    // Cleanup when component unmounts or user leaves
    useEffect(() => {
      return () => {
        // If recording is active when leaving, stop and upload
        if (isRecordingActive()) {
          console.log("User leaving meeting, stopping recording and uploading...");
          cleanupRecording();
        }
      };
    }, []);

    // Handle cleanup when call ends or user navigates away
    useEffect(() => {
      if (!call) return;

      // Cleanup function
      const handleCleanup = () => {
        if (isRecordingActive()) {
          console.log("Cleaning up recording before leaving");
          cleanupRecording();
        }
      };

      // Listen for browser navigation (back/forward)
      window.addEventListener('popstate', handleCleanup);

      // Cleanup on component unmount (covers React Router navigation)
      return () => {
        handleCleanup();
        window.removeEventListener('popstate', handleCleanup);
      };
    }, [call]);

    

    if (!client || !call) return <div>Loading...</div>;

    return (
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <StreamTheme>
            <div className="flex flex-row w-full overflow-hidden ">
              {/* Main video area */}
              <div
                className={`flex flex-col h-full ${
                  showParticipantList ? "w-[100vw]" : "w-[100vw]"
                }`}
              >
                <div className="flex-grow h-[90vh] text-neutral-200 bg-gray-900 flex justify-center items-center">
                  {/* Show video tiles */}
                  <SpeakerLayout />
                </div>

                {/* Controls Section */}
                <div className="absolute h-[10vh] bottom-0 w-[100%] bg-black flex justify-center items-center gap-4 text-white">
                  <CallControls />
                  <button className="bg-amber-400 p-2 rounded-full" onClick={() => handleRecord()}>
                    record
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="absolute right-0 bg-slate-800 p-3 rounded-full"
                  >
                    <i className="fa-solid fa-users"></i>
                  </button>
                </div>
              </div>

              {/* Sidebar for participants */}
              <div
                className={`absolute right-0 bg-blue-600 h-[90vh] py-5 overflow-hidden overflow-x-hidden transition-all duration-500 ease-in-out ${
                  showParticipantList
                    ? "w-[20vw] translate-x-0"
                    : "w-0 translate-x-full"
                }`}
              >
                {showParticipantList && <CallParticipantsList />}
              </div>
            </div>
          </StreamTheme>
        </StreamCall>
      </StreamVideo>
    );
  };

  export default MeetingUI;