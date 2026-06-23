import React from 'react'
import { useState } from 'react'
import MeetingUI from './MeetingUI';

const MeetingUIWrapper = (join, setJoin) => {
      const [showParticipantList, setShowParticipantList] = useState(false);
    //   const [join, setJoin] = useState(false);
    return (
        <div className='h-screen bg-surface-dark'>
          <MeetingUI showParticipantList={showParticipantList} setShowParticipantList={setShowParticipantList} join={join} setJoin={setJoin}/>
        </div>
    )
}

export default MeetingUIWrapper;