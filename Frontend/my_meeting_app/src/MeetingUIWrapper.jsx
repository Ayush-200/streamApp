import React from 'react'
import { useState } from 'react'
import MeetingUI from './MeetingUI';

const MeetingUIWrapper = (join, setJoin) => {
      const [showParticipantList, setShowParticipantList] = useState(false);
    //   const [join, setJoin] = useState(false);
    return (
        <>
        <div className='flex flex-row bg-red-600 h-[100vh]'>
            <div className={`bg-amber-300 h-[100vh] `}>
                <MeetingUI showParticipantList={showParticipantList} setShowParticipantList={setShowParticipantList} join = {join} setJoin = {setJoin}/>
            </div>
        </div>
        </>
    )
}

export default MeetingUIWrapper;