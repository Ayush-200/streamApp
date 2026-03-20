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
  import { useParams, useNavigate } from "react-router-dom";
  import  socket  from './utils/socket.js';
  import { useAuth0 } from "@auth0/auth0-react";
  import {startRecording, stopRecording, cleanupRecording, isRecordingActive } from './utils/recording.js';
  import { setMeetingName } from './db/db.js';
  const apiKey = "55gcbd3wd3nk";

  const MeetingUI = ({ showParticipantList, setShowParticipantList, join, setJoin }) => {
    const [client, setClient] = useState(null);
    const [recording, setRecording] = useState(false);
    const [call, setCall] = useState(null);
    const { meetingName } = useParams();
    const { user, isLoading, isAuthenticated } = useAuth0();
    const navigate = useNavigate();

    const handleSubmit = () => {
      setShowParticipantList(!showParticipantList);
    };

    // Manual leave function for testing
    const handleManualLeave = () => {
      console.log("🧪 [TEST] Manual leave button clicked");
      console.log("👤 [TEST] User:", user?.email);
      console.log("📍 [TEST] Meeting:", meetingName);
      
      if (user?.email && meetingName) {
        console.log("📡 [TEST] Emitting leave_meeting event...");
        socket.emit("leave_meeting", { meetingId: meetingName, userId: user.email });
        console.log("✅ [TEST] Event emitted");
      } else {
        console.error("❌ [TEST] Missing user or meeting info");
      }
    };

    // Proper hangup function
    const handleHangup = async () => {
      console.log("📞 [HANGUP] ========== LEAVING MEETING ==========");
      
      try {
        // Stop recording if active
        if (isRecordingActive()) {
          console.log("🛑 [HANGUP] Stopping active recording...");
          cleanupRecording();
        }
        
        // Emit leave_meeting event
        if (user?.email && meetingName) {
          console.log("📡 [HANGUP] Emitting leave_meeting event...");
          socket.emit("leave_meeting", { meetingId: meetingName, userId: user.email });
        }
        
        // Leave the call first (this handles media cleanup internally)
        if (call) {
          console.log("📞 [HANGUP] Leaving call...");
          await call.leave();
        }
        
        // Clean up client
        if (client) {
          console.log("🧹 [HANGUP] Disconnecting client...");
          await client.disconnectUser();
        }
        
        console.log("✅ [HANGUP] Cleanup complete");
        
      } catch (error) {
        console.error("❌ [HANGUP] Error during hangup:", error);
      } finally {
        // Always navigate, even if there's an error
        console.log("🏠 [HANGUP] Navigating to /home...");
        navigate('/home', { replace: true });
      }
      
      console.log("📞 [HANGUP] ========== LEAVE COMPLETE ==========\n");
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
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/token/${userId}`);
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
      
      console.log("🎬 [MEETING_UI] ========== SETTING UP MEETING ==========");
      console.log("👤 [MEETING_UI] User:", user.email);
      console.log("📍 [MEETING_UI] Meeting:", meetingName);
      console.log("🎙️ [MEETING_UI] Recording:", recording);
      console.log("🔌 [MEETING_UI] Socket connected:", socket.connected);
      
      // Set meeting name in db.js for global access
      setMeetingName(meetingName);

      // Function to emit join_meeting
      const emitJoinMeeting = () => {
        console.log("📡 [MEETING_UI] Emitting join_meeting event...");
        socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});
      };

      // Wait for socket to be connected before emitting
      if (socket.connected) {
        console.log("✅ [MEETING_UI] Socket already connected, emitting immediately");
        emitJoinMeeting();
      } else {
        console.log("⏳ [MEETING_UI] Socket not connected, waiting for connection...");
        
        // Listen for connection and then emit
        const handleConnect = () => {
          console.log("✅ [MEETING_UI] Socket connected, now emitting join_meeting");
          emitJoinMeeting();
          socket.off("connect", handleConnect); // Remove listener after use
        };
        
        socket.on("connect", handleConnect);
      }

      socket.on("start_recording", () =>{
        console.log("🔴 [MEETING_UI] start_recording event received");
        setRecording(true);
        startRecording(meetingName, user?.email);
      });

      socket.on("stop_recording", () =>{
        console.log("⏹️ [MEETING_UI] stop_recording event received");
        stopRecording(meetingName);
        
      })

      socket.on("download_ready", ({url}) =>{
      console.log("📥 [MEETING_UI] download_ready at:", url);
      window.location.href = `${import.meta.env.VITE_BACKEND_URL}${url}`;
      })
      
      socket.on("joined_meeting", (meetingId) => {
        console.log("✅ [MEETING_UI] joined_meeting confirmation for:", meetingId);
      });

      // Cleanup function when user leaves
      return () => {
        console.log("🚪 [MEETING_UI] ========== CLEANUP: USER LEAVING ==========");
        console.log("👤 [MEETING_UI] User leaving:", user.email);
        console.log("📍 [MEETING_UI] From meeting:", meetingName);
        console.log("📡 [MEETING_UI] Emitting leave_meeting event...");
        
        socket.emit("leave_meeting", { meetingId: meetingName, userId: user.email });
        
        console.log("🧹 [MEETING_UI] Removing socket listeners...");
        socket.off("start_recording");
        socket.off("stop_recording");
        socket.off("join_meeting");
        socket.off("ready_to_download");
        
        console.log("✅ [MEETING_UI] Cleanup complete");
        console.log("🚪 [MEETING_UI] ========== LEAVE COMPLETE ==========\n");
      };
    }, [call, meetingName, user]);

    // Cleanup when component unmounts or user leaves
    useEffect(() => {
      return () => {
        console.log("🧹 [CLEANUP] Component unmounting...");
        
        // If recording is active when leaving, stop and upload
        if (isRecordingActive()) {
          console.log("🛑 [CLEANUP] Stopping recording...");
          cleanupRecording();
        }
        
        // Note: Media tracks are cleaned up by call.leave() in handleHangup
        // Don't try to access camera.getStream() here as it may cause errors
        console.log("✅ [CLEANUP] Cleanup complete");
      };
    }, []);

    // Warn user before leaving/closing tab if recording is active
    useEffect(() => {
      const handleBeforeUnload = (e) => {
        console.log("🌐 [BROWSER] beforeunload event triggered");
        
        // Emit leave_meeting before page unload
        if (user?.email && meetingName) {
          console.log("📡 [BROWSER] Emitting leave_meeting before unload");
          console.log("👤 [BROWSER] User:", user.email);
          console.log("📍 [BROWSER] Meeting:", meetingName);
          socket.emit("leave_meeting", { meetingId: meetingName, userId: user.email });
        }
        
        if (isRecordingActive()) {
          console.warn("⚠️ [BROWSER] Recording is active, showing warning");
          e.preventDefault();
          e.returnValue = '';
          const message = 'Recording is in progress. If you leave now, your recording may be lost. Are you sure you want to leave?';
          e.returnValue = message;
          return message;
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, [recording, user, meetingName]);

    // Handle cleanup when user navigates away using browser back button
    useEffect(() => {
      if (!call) return;

      const handlePopState = () => {
        console.log("🔙 [NAVIGATION] Browser back button pressed");
        
        // Emit leave_meeting on navigation
        if (user?.email && meetingName) {
          console.log("📡 [NAVIGATION] Emitting leave_meeting");
          socket.emit("leave_meeting", { meetingId: meetingName, userId: user.email });
        }
        
        if (isRecordingActive()) {
          console.log("🧹 [NAVIGATION] Cleaning up recording");
          cleanupRecording();
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }, [call, user, meetingName]);

    

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
                  <button className="bg-red-600 hover:bg-red-700 p-3 px-6 rounded-lg text-white font-semibold" onClick={handleHangup}>
                    Leave Call
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