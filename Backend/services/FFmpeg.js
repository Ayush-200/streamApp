import dotenv from "dotenv";
import { MeetingParticipantDB } from "../MongoDB/model.js";
dotenv.config();
export async function mergeAndDownloadVideo(meetingId) {
  console.log("inside merge and donwload");
  const participantsDoc = await MeetingParticipantDB.findOne({ meetingId }).lean();
  const video1 = participantsDoc.participants[0]?.videoPublicId;
  const video2 = participantsDoc.participants[1]?.videoPublicId;

  if(!video1 || !video2) throw new Error("Missing participant videos");
  const fetchAndMerge = await fetch(`${process.env.FFMPEG_WORKER_URL}/stitch`,{ 
    method: "POST", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoUrls: [video1, video2]})
  })

  if(!fetchAndMerge.ok){
    console.error("FFMPEG Worker error:", await fetchAndMerge.text()); 
  }

}

