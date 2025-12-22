// import ffmpegPath from "ffmpeg-static";
// import { spawn } from "child_process";
// import { v2 as cloudinary } from "cloudinary";
// import path from 'path';
// import { fileURLToPath } from "url";
// import { dirname } from "path";

// // const ffmpeg = spawn(ffmpegPath, args);

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
// // Cloudinary config
// cloudinary.config({
//   cloud_name: process.env.CLOUD_NAME,
//   api_key: process.env.CLOUD_KEY,
//   api_secret: process.env.CLOUD_SECRET,
// });

// /**
//  * Fetch meeting videos from Cloudinary
//  * Assuming you upload videos with a common tag like "meeting-123"
//  */
// async function getMeetingVideos(meetingId) {
//   try {
//     const result = await cloudinary.search
//       .expression(`resource_type:video AND tags=${meetingId}`)
//       .sort_by("created_at", "desc")
//       .max_results(6)
//       .execute();

//     // Extract secure video URLs
//     return result.resources.map((res) => res.secure_url);
//   } catch (err) {
//     console.error("Error fetching videos:", err);
//     return [];
//   }
// }

// /**
//  * Run FFmpeg to make grid view from videos
//  */
// function runFFmpeg(videoUrls, outputFile = "output.mp4") {
//   return new Promise((resolve, reject) => {
//     if (videoUrls.length < 2) {
//       return reject(new Error("Need at least 2 videos for grid"));
//     }

//     // Inputs
//     const args = [];
//     videoUrls.forEach((url) => {
//       args.push("-i", url);
//     });

//     const count = videoUrls.length;

//     // Build filter_complex based on number of videos
//     let filter = "";
//     if (count === 2) {
//       filter = "[0:v][1:v]hstack=inputs=2[out]";
//     } else if (count === 3 || count === 4) {
//       filter =
//         count === 3
//           ? "[0:v][1:v]hstack=2[top];[top][2:v]vstack=2[out]"
//           : "[0:v][1:v]hstack=2[top];[2:v][3:v]hstack=2[bottom];[top][bottom]vstack=2[out]";
//     } else if (count >= 5 && count <= 6) {
//       filter =
//         count === 5
//           ? "[0:v][1:v]hstack=2[top];[2:v][3:v]hstack=2[mid];[4:v]scale=640:360[extra];[mid][extra]hstack=2[mid2];[top][mid2]vstack=2[out]"
//           : "[0:v][1:v]hstack=2[top];[2:v][3:v]hstack=2[mid];[4:v][5:v]hstack=2[bottom];[top][mid]vstack=2[topmid];[topmid][bottom]vstack=2[out]";
//     }

//     args.push(
//       "-filter_complex",
//       filter,
//       "-map",
//       "[out]",
//       "-c:v",
//       "libx264",
//       "-preset",
//       "veryfast",
//       "-crf",
//       "23",
//       outputFile
//     );

//     const ffmpeg = spawn(ffmpegPath, args);

//     ffmpeg.stderr.on("data", (data) => {
//       console.log(`FFmpeg: ${data}`);
//     });

//     ffmpeg.on("close", (code) => {
//       if (code === 0) {
//         resolve(outputFile);
//       } else {
//         reject(new Error(`FFmpeg exited with code ${code}`));
//       }
//     });
//   });
// }

// export async function mergeAndDownloadVideo(meetingId){

  
//   try {
//     // 1. Fetch meeting videos from Cloudinary
//     const videos = await getMeetingVideos(meetingId);
//     console.log("videos");
//     console.log(videos);

//     if (videos.length < 2) {
//       throw new Error("need atleat 2 videos to donwload ");
//     }

//     // 2. Run ffmpeg
//     const outputFile = path.join(__dirname, `grid_${meetingId}.mp4`);
//     await runFFmpeg(videos, outputFile);

//     // 3. Send file as download
//     return outputFile;
//   } catch (err) {
//     console.error("Error merging videos:", err); 
//     // throw err;
//   }
// }

// import { MeetingParticipantDB } from "./MongoDB/model.js";
// import axios from "axios";
// import path from "path";
// import fs from "fs";

// export async function mergeAndDownloadVideo(meetingId) {
//   console.log("inside merge and donwload");
//   const participantsDoc = await MeetingParticipantDB.findOne({ meetingId });
//   const participants = participantsDoc.participants;
  
//   const videos = participants.map((p) => ({
//     userEmail: p.userId,
//     videoUrl: p.videoPublicId,
//     joinTime: p.joinTime,
//     leaveTime: p.leaveTime
//   }));
  
//   // Step 1: Build timeline
//   console.log(videos);
//   const segments = buildTimeline(videos);
//   console.log("segments", segments)

//   // ensure tmp directory exists
//   fs.mkdirSync("tmp", { recursive: true });

//   // Step 2: download all videos
//   for (let v of videos) {
//     const filePath = path.join("tmp", `${v.userEmail}.mp4`);
//     await downloadVideo(v.videoUrl, filePath);
//     v.localPath = filePath;
//   }

//   let segmentFiles = [];

//   // // Step 3: Process each segment

//   console.log("preparing segment files...")
//   for (let seg of segments) {
//     const layout = getLayoutForUserCount(seg.users.length);
//     const outFile = `tmp/seg-${seg.start}-${seg.end}.mp4`;

//     await runFFmpegLayout({
//       users: seg.users,
//       layout,
//       start: seg.start,
//       end: seg.end,
//       output: outFile
//     });

//     segmentFiles.push(outFile);
//   }

//   console.log("segment files prepared!");
//   console.log(segmentFiles);

//   // // Step 4: Concatenate segments
//   const finalVideo = await concatSegments(segmentFiles, meetingId);
//   await saveFile(finalVideo, "mergedVideos");
//   // return finalVideo;
//   return 0;
// }



// export async function downloadVideo(url, filePath) {
//   console.log("inside download video");
//   const writer = fs.createWriteStream(filePath);
//   console.log(url); 
//   const responseVideo = await axios({
//     url, 
//     method: "GET", 
//     responseType: "stream"
//   });

//   responseVideo.data.pipe(writer);

//   return new Promise((resolve, reject) => {
//     writer.on("finish", () => resolve(filePath));
//     writer.on("error", reject);
//   })

// }


// export function buildTimeline(videos) {
//   let events = [];
//   console.log("inside build timeline")

//   // build join-leave events
//   videos.forEach(v => {
//     events.push({ time: new Date(v.joinTime).getTime(), type: "join", user: v });
//     events.push({ time: new Date(v.leaveTime).getTime(), type: "leave", user: v });
//   });

//   // sort events by time
//   events.sort((a, b) => a.time - b.time);

//   let activeUsers = new Set();
//   let timeline = [];

//   for (let i = 0; i < events.length - 1; i++) {
//     const evt = events[i];

//     if (evt.type === "join") activeUsers.add(evt.user);
//     else if (evt.type === "leave") activeUsers.delete(evt.user);

//     const nextTime = events[i + 1].time;

//     if (nextTime > evt.time && activeUsers.size > 0) {
//       timeline.push({
//         start: evt.time,
//         end: nextTime,
//         users: Array.from(activeUsers)
//       });
//     }
//   }

//   console.log("returning the timeline ");
//   return timeline;
// }


// export function getLayoutForUserCount(n) {
//   if (n === 1) return { rows: 1, cols: 1 };
//   if (n === 2) return { rows: 1, cols: 2 };
//   if (n === 3) return { rows: 2, cols: 2 }; // 4 slots, 1 empty
//   if (n === 4) return { rows: 2, cols: 2 };
//   if (n <= 6) return { rows: 2, cols: 3 };
//   return { rows: 3, cols: 3 };
// }


// import { exec } from "child_process";
// import util from "util";
// const execPromise = util.promisify(exec);

// export async function runFFmpegLayout({ users, layout, start, end, output }) {
//   const durationSec = (end - start) / 1000;

//   const { rows, cols } = layout;
//   const W = 1920; // output width
//   const H = 1080; // output height
//   const cellW = Math.floor(W / cols);
//   const cellH = Math.floor(H / rows);

//   let filter = "";
//   let inputs = "";

//   users.forEach((u, i) => {
//     inputs += `-i ${u.localPath} `;
//   });

//   // trim + scale each input
//   users.forEach((u, i) => {
//     filter += `[${i}:v]trim=start=${start/1000}:duration=${durationSec},setpts=PTS-STARTPTS,scale=${cellW}:${cellH}[v${i}];`
//   });

//   // grid placement
//   let overlays = "";
//   users.forEach((u, i) => {
//     const r = Math.floor(i / cols);
//     const c = i % cols;
//     const x = c * cellW;
//     const y = r * cellH;

//     if (i === 0) overlays += `[v0]pad=${W}:${H}[base];`;
//     overlays += `[${i === 0 ? "base" : "tmp"+(i-1)}][v${i}]overlay=${x}:${y}${i === users.length-1 ? "[out]" : "[tmp"+i+"];"}`
//   });

//   const fullFilter = filter + overlays;

//   const cmd = `
//     ffmpeg -y ${inputs}
//     -filter_complex "${fullFilter}"
//     -map "[out]"
//     -t ${durationSec}
//     ${output}
//   `.replace(/\s\s+/g, " ");

//   await execPromise(cmd);
// }


// export async function concatSegments(segmentFiles, meetingId) {
//   const listFile = `tmp/${meetingId}-list.txt`;

//   const content = segmentFiles.map(f => `file '${f}'`).join("\n");
//   // ensure directory exists for list file
//   fs.mkdirSync(path.dirname(listFile), { recursive: true });
//   fs.writeFileSync(listFile, content);

//   const output = `tmp/final-${meetingId}.mp4`;
//   const cmd = `
//     ffmpeg -y -f concat  -safe 0 -i ${listFile} -c copy ${output}
//   `;

//   await execPromise(cmd);
//   return output;
// }


// export function saveFile(srcPath, destDir) {
//   fs.mkdirSync(destDir, { recursive: true });
//   const base = path.basename(srcPath);
//   const destPath = path.join(destDir, base);

//   return new Promise((resolve, reject) => {
//     fs.rename(srcPath, destPath, (err) => {
//       if (err) return reject(err);
//       resolve(destPath);
//     });
//   });
// }
// import { spawn } from "child_process";
// import path from "path";
// import { MeetingParticipantDB } from "./MongoDB/model.js";
// import fs from "fs";


// export async function mergeAndDownloadVideo(meetingId) {
//   const cloud_name = process.env.CLOUDINARY_CLOUD_NAME
//   // Ensure temp directory
//   fs.mkdirSync("tmp", { recursive: true });

//   // 1. Fetch document correctly
//   const participantsDoc = await MeetingParticipantDB.findOne({ meetingId }).lean();
//   if (!participantsDoc) throw new Error("Meeting not found");

//   const video1 = participantsDoc.participants[0]?.videoPublicId;
//   const video2 = participantsDoc.participants[1]?.videoPublicId;

//   if (!video1 || !video2) throw new Error("Missing participant videos");

//   const url1 = `https://res.cloudinary.com/<${cloud_name}>/video/upload/${video1}.mp4`;
//   const url2 = `https://res.cloudinary.com/<${cloud_name}>/video/upload/${video2}.mp4`;

//   const outputFile = path.join("tmp", `final-${meetingId}.mp4`);

//   return new Promise((resolve, reject) => {
//     const ffmpeg = spawn("ffmpeg", [
//       "-y",
//       "-i", url1,
//       "-i", url2,

//       // SIDE-BY-SIDE MERGE
//       "-filter_complex", "hstack=inputs=2",

//       "-c:v", "libx264",
//       "-c:a", "aac",

//       outputFile
//     ]);

//     ffmpeg.stderr.on("data", d => console.log(d.toString()));
//     ffmpeg.on("error", reject);

//     ffmpeg.on("close", code => {
//       if (code === 0) resolve(outputFile);
//       else reject(new Error("ffmpeg exited with code " + code));
//     }); 
//   });
// }

import dotenv from "dotenv";
import { MeetingParticipantDB } from "./MongoDB/model";
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

