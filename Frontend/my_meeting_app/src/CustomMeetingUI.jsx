// import React, { useState, useEffect } from "react";
// import { useCallStateHooks, ParticipantView } from "@stream-io/video-react-sdk";

// const CustomMeetingUI = () => {
//   const { useParticipants } = useCallStateHooks();
//   const participants = useParticipants();
//   const [page, setPage] = useState(0);

//   useEffect(() => {
//     console.log("Participants:", participants);
//   }, [participants]);

//   const pageSize = 6;
//   const totalPages = Math.ceil(participants.length / pageSize);
//   const currentParticipants = participants.slice(page * pageSize, (page + 1) * pageSize);

//   const getGridClass = (count) => {
//     if (count === 1) return "grid-cols-1 grid-rows-1";
//     if (count === 2) return "grid-cols-2 grid-rows-1";
//     if (count <= 4) return "grid-cols-2 grid-rows-2";
//     return "grid-cols-3 grid-rows-2";
//   };

//   return (
//     <div className="relative w-full h-full bg-black flex">
//       <div className={`grid flex-1 gap-2 p-2 ${getGridClass(currentParticipants.length)}`}>
//         {currentParticipants.map((p) => (
//           <div
//             key={p.sessionId}
//             className="relative flex justify-center bg-gray-900 rounded-lg overflow-auto" // Changed to overflow-auto
//           >
//             <ParticipantView
//               participant={p}
//               className="w-full h-full object-cover"
//             />
//             <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
//               {p.isScreenShare ? "Screen Share" : p.userId}
//             </span>
//           </div>
//         ))}
//       </div>

//       {totalPages > 1 && (
//         <>
//           {page > 0 && (
//             <button
//               className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/30 text-white px-2 py-1 rounded-full hover:bg-white/50"
//               onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
//             >
//               ◀
//             </button>
//           )}
//           {page < totalPages - 1 && (
//             <button
//               className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/30 text-white px-2 py-1 rounded-full hover:bg-white/50"
//               onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
//             >
//               ▶
//             </button>
//           )}
//         </>
//       )}
//     </div>
//   );
// };

// export default CustomMeetingUI;


import {
  StreamVideo,
  StreamCall,
  PaginatedGridLayout,
  useCallStateHooks,
  useParticipantViewContext,
  // VideoPlaceholderProps,
} from "@stream-io/video-react-sdk";

export const CustomParticipantViewUI = () => {
  const { participant } = useParticipantViewContext();
  return (
    <div className="relative w-full h-full bg-black">
      <span className="absolute bottom-2 left-2 text-white text-sm">
        {participant.name || participant.id}
      </span>
    </div>
  );
};

export const CustomVideoPlaceholder = ({ style }) => {
  const { participant } = useParticipantViewContext();
  return (
    <div className="flex items-center justify-center bg-gray-700" style={style}>
      <span className="text-white">{participant.name || participant.id}</span>
    </div>
  );
};

export const CustomLayoutWrapper = () => {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();

  if (participants.length === 1) {
    // Just render one participant full screen
    return (
      <div className="w-full h-full">
        <CustomParticipantViewUI />
      </div>
    );
  }
}