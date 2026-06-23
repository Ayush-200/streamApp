import { useState } from 'react'
import './App.css'
// import MeetingUI from './MeetingUI';  
import { useAuth0 } from "@auth0/auth0-react";
import LoginButton from './LoginButton';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from './Home';
import MeetingUIWrapper from './MeetingUIWrapper';
import CreateMeetingForm from './CreateMeetingForm';
import ScheduleMeeting from './ScheduleMeeting';
import JoinMeetingForm from './JoinMeetingForm';
import ViewRecording from './ViewRecording';

function App() {

  const {isAuthenticated} = useAuth0();
  const [join, setJoin] = useState(false);
  const [user, setUser] = useState(null);
  return (
    <Router>
      <Routes>
        <Route path = '/' element = {<LoginButton setUser = {setUser} />} />
        <Route path = '/home' element = {<Home  setJoin = {setJoin}/>} />
        <Route path = '/meeting/:meetingName' element = {(<MeetingUIWrapper join = {join} setJoin = {setJoin}/>)} />
          <Route path = '/createMeetingForm' element = {<CreateMeetingForm/>} />
          <Route path = '/ScheduleMeeting' element = {<ScheduleMeeting user = {user}/>} />
          <Route path = '/joinMeetingForm' element = {<JoinMeetingForm />} />
        <Route path = '*' element = {
          <div className='flex items-center justify-center min-h-screen bg-surface-dark'>
            <div className='text-center'>
              <h1 className='text-6xl font-heading font-bold bg-gradient-to-r from-brand-amber to-brand-orange bg-clip-text text-transparent mb-4'>404</h1>
              <p className='text-text-secondary'>Page not found</p>
            </div>
          </div>
        } />
        {/* <Route path = '/viewRecordings' element = {<ViewRecording />} /> */}
      </Routes>
    </Router>
    
  )
}

export default App;