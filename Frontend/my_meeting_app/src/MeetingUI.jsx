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
  import { initializeSocket } from './utils/socket.js';
  import { useAuth0 } from "@auth0/auth0-react";
  import {startRecording, stopRecording, cleanupRecording, isRecordingActive, saveCurrentBlobAndStop, cleanupMeetingStartTime } from './utils/recording.js';
  import { setMeetingName } from './db/db.js';

  const MeetingUI = ({ showParticipantList, setShowParticipantList, join, setJoin }) => {
    const [client, setClient] = useState(null);
    const [recording, setRecording] = useState(false);
    const [call, setCall] = useState(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [socket, setSocket] = useState(null);
    const { meetingName } = useParams();
    const { user, isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
    const navigate = useNavigate();

    const handleSubmit = () => {
      setShowParticipantList(!showParticipantList);
    };

    // Proper hangup function
    const handleHangup = async () => {
      console.log("📞 Leaving meeting...");
      setIsLeaving(true);
      
      // Save current recording blob if active
      if (isRecordingActive()) {
        await saveCurrentBlobAndStop();
      }
      
      // Stop media tracks
      if (call) {
        await call.camera.disable().catch(err => console.warn("Camera disable error:", err));
        await call.microphone.disable().catch(err => console.warn("Mic disable error:", err));
      }
      
      // Get lastSegmentIndex from localStorage
      let lastSegmentIndex = -1;
      if (user?.email && meetingName) {
        const storageKey = `lastSegment_${meetingName}_${user.email}`;
        const storedIndex = localStorage.getItem(storageKey);
        if (storedIndex !== null) {
          lastSegmentIndex = parseInt(storedIndex, 10);
        }
      }
      
      // Emit leave event
      if (user?.email && meetingName) {
        socket.emit("leave_meeting", { 
          meetingId: meetingName, 
          userId: user.email,
          lastSegmentIndex
        });
      }
      
      // Leave call and disconnect
      if (call) await call.leave();
      if (client) await client.disconnectUser();
      
      navigate('/home', { replace: true });
    };

    function handleRecord() {
      if (!recording) {
        socket.emit("start_recording", meetingName);
        setRecording(true);
      } else {
        socket.emit("stop_recording", meetingName);
        setRecording(false);
      }
    }


    useEffect(() => {
      if (isLoading || !isAuthenticated) return;

      const init = async () => {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com'}/api/v2/`,
          }
        });
        
        const socketInstance = initializeSocket(token);
        setSocket(socketInstance);
        
        let userId = user.email.replace(/[@.]/g, "_");
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/token/${userId}`);
        const { token: streamToken, apiKey } = await response.json();

        const userObj = { id: userId, name: user.name };
        const c = new StreamVideoClient({ apiKey, user: userObj, token: streamToken });
        const callInstance = c.call("default", `${meetingName || "test-room"}`);

        if (join) {
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
        } else {
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
      };

      init();
    }, [isLoading, isAuthenticated, user, join, meetingName]);
    
    // Effect 1: Emit join_meeting when call and socket are ready
    useEffect(() => {
      if (!call || !user || !socket) return;
      
      socket.emit("join_meeting", { meetingId: meetingName, userId: user.email });
    }, [call, socket]);
    
    // Effect 2: Setup socket listeners
    useEffect(() => {
      if (!call || !user || !socket) return;
      
      setMeetingName(meetingName);
      let recordingStarted = false;

      const handleStartRecording = () => {
        if (!recordingStarted) {
          recordingStarted = true;
          setRecording(true);
          startRecording(meetingName, user?.email, getAccessTokenSilently);
        }
      };

      const handleStopRecording = () => {
        recordingStarted = false;
        setRecording(false);
        stopRecording(meetingName);
        cleanupMeetingStartTime(meetingName, user?.email);
      };

      const handleDownloadReady = ({ url }) => {
        window.location.href = `${import.meta.env.VITE_BACKEND_URL}${url}`;
      };
      
      const handleJoinedMeeting = ({ meetingId, isRecording }) => {
        if (isRecording && !recordingStarted && !isRecordingActive()) {
          recordingStarted = true;
          setRecording(true);
          startRecording(meetingName, user?.email, getAccessTokenSilently);
        }
      };

      socket.on("start_recording", handleStartRecording);
      socket.on("stop_recording", handleStopRecording);
      socket.on("download_ready", handleDownloadReady);
      socket.on("joined_meeting", handleJoinedMeeting);

      return () => {
        socket.off("start_recording", handleStartRecording);
        socket.off("stop_recording", handleStopRecording);
        socket.off("download_ready", handleDownloadReady);
        socket.off("joined_meeting", handleJoinedMeeting);
      };
    }, [call, meetingName, user, socket]);

    // Cleanup when component unmounts
    useEffect(() => {
      return () => {
        if (isRecordingActive()) {
          cleanupRecording();
        }
      };
    }, []);

    // Warn user before closing tab if recording is active
    useEffect(() => {
      const handleBeforeUnload = (e) => {
        // Emit leave_meeting before page unload
        if (user?.email && meetingName) {
          socket.emit("leave_meeting", { meetingId: meetingName, userId: user.email });
        }
        
        if (isRecordingActive()) {
          e.preventDefault();
          e.returnValue = '';
          return 'Recording is in progress. If you leave now, your recording may be lost.';
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [recording, user, meetingName]);

    // Handle browser back button
    useEffect(() => {
      if (!call) return;

      const handlePopState = () => {
        if (user?.email && meetingName) {
          socket.emit("leave_meeting", { meetingId: meetingName, userId: user.email });
        }
        if (isRecordingActive()) {
          cleanupRecording();
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
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