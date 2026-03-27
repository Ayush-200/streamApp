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
  import {startRecording, stopRecording, cleanupRecording, isRecordingActive, saveCurrentBlobAndStop, cleanupMeetingStartTime } from './utils/recording.js';
  import { setMeetingName } from './db/db.js';
  const apiKey = "55gcbd3wd3nk";

  const MeetingUI = ({ showParticipantList, setShowParticipantList, join, setJoin }) => {
    const [client, setClient] = useState(null);
    const [recording, setRecording] = useState(false);
    const [call, setCall] = useState(null);
    const [isLeaving, setIsLeaving] = useState(false);
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
      
      // Show loading state
      setIsLeaving(true);
      
      try {
        // Save current recording blob if active
        if (isRecordingActive()) {
          console.log("💾 [HANGUP] Saving current recording blob to IndexedDB...");
          await saveCurrentBlobAndStop();
          console.log("✅ [HANGUP] Recording blob saved successfully");
        }
        
        // Stop all media tracks from the call BEFORE leaving
        if (call) {
          console.log("📹 [HANGUP] Stopping camera and microphone...");
          
          try {
            // Stop camera
            await call.camera.disable();
            console.log("✅ [HANGUP] Camera disabled");
          } catch (err) {
            console.warn("⚠️ [HANGUP] Error disabling camera:", err);
          }
          
          try {
            // Stop microphone
            await call.microphone.disable();
            console.log("✅ [HANGUP] Microphone disabled");
          } catch (err) {
            console.warn("⚠️ [HANGUP] Error disabling microphone:", err);
          }
        }
        
        // Get lastSegmentIndex from localStorage
        let lastSegmentIndex = -1;
        if (user?.email && meetingName) {
          const storageKey = `lastSegment_${meetingName}_${user.email}`;
          const storedIndex = localStorage.getItem(storageKey);
          if (storedIndex !== null) {
            lastSegmentIndex = parseInt(storedIndex, 10);
            console.log(`📊 [HANGUP] Last segment index: ${lastSegmentIndex}`);
          }
        }
        
        // Emit leave_meeting event with lastSegmentIndex
        if (user?.email && meetingName) {
          console.log("📡 [HANGUP] Emitting leave_meeting event...");
          socket.emit("leave_meeting", { 
            meetingId: meetingName, 
            userId: user.email,
            lastSegmentIndex: lastSegmentIndex
          });
        }
        
        // Leave the call
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
    
    // Effect 1: Emit join_meeting ONCE when call is ready
    useEffect(() => {
      if (!call || !user) return;
      
      console.log("📡 [MEETING_UI] Emitting join_meeting event (once)...");
      socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});
      
    }, [call]); // ← Only runs when call is first set
    
    // Effect 2: Setup socket listeners
    useEffect(() => {
      if (!call || !user) return;
      
      console.log("🎬 [MEETING_UI] ========== SETTING UP SOCKET LISTENERS ==========");
      console.log("👤 [MEETING_UI] User:", user.email);
      console.log("📍 [MEETING_UI] Meeting:", meetingName);
      
      // Set meeting name in db.js for global access
      setMeetingName(meetingName);

      // ✅ Track if recording has been started to prevent duplicates
      let recordingStarted = false;

      const handleStartRecording = () => {
        console.log("🔴 [MEETING_UI] start_recording event received");
        if (!recordingStarted) {
          recordingStarted = true;
          setRecording(true);
          startRecording(meetingName, user?.email);
        } else {
          console.warn("⚠️ [MEETING_UI] Recording already started, ignoring duplicate event");
        }
      };

      const handleStopRecording = () => {
        console.log("⏹️ [MEETING_UI] stop_recording event received");
        recordingStarted = false;
        setRecording(false);
        stopRecording(meetingName);
        
        // Clean up meeting start time when recording is stopped by host
        cleanupMeetingStartTime(meetingName, user?.email);
      };

      const handleDownloadReady = ({url}) => {
        console.log("📥 [MEETING_UI] download_ready at:", url);
        window.location.href = `${import.meta.env.VITE_BACKEND_URL}${url}`;
      };
      
      const handleJoinedMeeting = ({ meetingId, isRecording }) => {
        console.log("✅ [MEETING_UI] joined_meeting confirmation for:", meetingId);
        console.log("🎥 [MEETING_UI] Recording in progress:", isRecording);
        
        // If recording is already in progress, start recording for this user
        if (isRecording && !recordingStarted && !isRecordingActive()) {
          console.log("🔴 [MEETING_UI] Auto-starting recording for newly joined user");
          recordingStarted = true;
          setRecording(true);
          startRecording(meetingName, user?.email);
        }
      };

      // Add event listeners
      socket.on("start_recording", handleStartRecording);
      socket.on("stop_recording", handleStopRecording);
      socket.on("download_ready", handleDownloadReady);
      socket.on("joined_meeting", handleJoinedMeeting);

      // Cleanup function when user leaves
      return () => {
        console.log("🧹 [MEETING_UI] Removing socket listeners...");
        socket.off("start_recording", handleStartRecording);
        socket.off("stop_recording", handleStopRecording);
        socket.off("download_ready", handleDownloadReady);
        socket.off("joined_meeting", handleJoinedMeeting);
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

            {/* Loading Overlay */}
            {isLeaving && (
              <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
                <div className="bg-slate-800 p-8 rounded-xl shadow-2xl flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#FFBA08]"></div>
                  <p className="text-white text-xl font-semibold">Saving recording...</p>
                  <p className="text-gray-400 text-sm">Please wait while we save your data</p>
                </div>
              </div>
            )}
          </StreamTheme>
        </StreamCall>
      </StreamVideo>
    );
  };

  export default MeetingUI;