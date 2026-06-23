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

    

    if (!client || !call) return (
      <div className="flex items-center justify-center h-screen bg-surface-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-amber border-t-transparent"></div>
          <p className="text-text-secondary text-sm">Connecting to meeting...</p>
        </div>
      </div>
    );

    return (
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <StreamTheme>
            <div className="relative h-screen bg-surface-dark overflow-hidden">
              {/* Main video area */}
              <div className={`h-full ${showParticipantList ? "mr-[20vw]" : ""} transition-all duration-500 ease-in-out`}>
                <div className="h-full flex items-center justify-center">
                  <SpeakerLayout />
                </div>
              </div>

              {/* Controls Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-surface-dark/90 backdrop-blur-xl border-t border-border-default/30 flex items-center justify-center gap-3 px-4 z-30">
                <CallControls />
                <button
                  className={`p-2.5 rounded-xl transition-all duration-300 ${
                    recording
                      ? 'bg-brand-red text-white animate-pulse'
                      : 'bg-surface-elevated hover:bg-surface-hover text-text-primary'
                  }`}
                  onClick={() => handleRecord()}
                  title={recording ? 'Stop Recording' : 'Start Recording'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="6"/>
                  </svg>
                </button>
                <button
                  className="bg-brand-red hover:bg-red-700 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-brand-red/20"
                  onClick={handleHangup}
                >
                  Leave Call
                </button>
                <button
                  onClick={handleSubmit}
                  className={`p-2.5 rounded-xl transition-all duration-300 ${
                    showParticipantList
                      ? 'bg-brand-amber text-brand-navy'
                      : 'bg-surface-elevated hover:bg-surface-hover text-text-secondary'
                  }`}
                  title="Toggle participants"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </button>
              </div>

              {/* Participants Sidebar */}
              <div
                className={`fixed right-0 top-0 h-full bg-surface-card/95 backdrop-blur-xl border-l border-border-default/30 transition-all duration-500 ease-in-out z-20 ${
                  showParticipantList
                    ? "w-[20vw] min-w-[280px] translate-x-0"
                    : "w-0 translate-x-full"
                }`}
              >
                {showParticipantList && (
                  <div className="h-full p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-heading font-semibold text-text-primary text-sm">Participants</h3>
                      <button
                        onClick={handleSubmit}
                        className="text-text-muted hover:text-text-primary transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <CallParticipantsList />
                  </div>
                )}
              </div>
            </div>

            {isLeaving && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-surface-card/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-4 animate-scale-in">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-brand-amber border-t-transparent"></div>
                  <p className="text-text-primary text-lg font-heading font-semibold">Saving recording...</p>
                  <p className="text-text-muted text-sm">Please wait while we save your data</p>
                </div>
              </div>
            )}
          </StreamTheme>
        </StreamCall>
      </StreamVideo>
    );
  };

  export default MeetingUI;