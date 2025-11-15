import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { v2 as cloudinary } from "cloudinary";
import path from 'path';
import { fileURLToPath } from "url";
import { dirname } from "path";

// const ffmpeg = spawn(ffmpegPath, args);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

/**
 * Fetch meeting videos from Cloudinary
 * Assuming you upload videos with a common tag like "meeting-123"
 */
async function getMeetingVideos(meetingId) {
  try {
    const result = await cloudinary.search
      .expression(`resource_type:video AND tags=${meetingId}`)
      .sort_by("created_at", "desc")
      .max_results(6)
      .execute();

    // Extract secure video URLs
    return result.resources.map((res) => res.secure_url);
  } catch (err) {
    console.error("Error fetching videos:", err);
    return [];
  }
}

/**
 * Run FFmpeg to make grid view from videos
 */
function runFFmpeg(videoUrls, outputFile = "output.mp4") {
  return new Promise((resolve, reject) => {
    if (videoUrls.length < 2) {
      return reject(new Error("Need at least 2 videos for grid"));
    }

    // Inputs
    const args = [];
    videoUrls.forEach((url) => {
      args.push("-i", url);
    });

    const count = videoUrls.length;

    // Build filter_complex based on number of videos
    let filter = "";
    if (count === 2) {
      filter = "[0:v][1:v]hstack=inputs=2[out]";
    } else if (count === 3 || count === 4) {
      filter =
        count === 3
          ? "[0:v][1:v]hstack=2[top];[top][2:v]vstack=2[out]"
          : "[0:v][1:v]hstack=2[top];[2:v][3:v]hstack=2[bottom];[top][bottom]vstack=2[out]";
    } else if (count >= 5 && count <= 6) {
      filter =
        count === 5
          ? "[0:v][1:v]hstack=2[top];[2:v][3:v]hstack=2[mid];[4:v]scale=640:360[extra];[mid][extra]hstack=2[mid2];[top][mid2]vstack=2[out]"
          : "[0:v][1:v]hstack=2[top];[2:v][3:v]hstack=2[mid];[4:v][5:v]hstack=2[bottom];[top][mid]vstack=2[topmid];[topmid][bottom]vstack=2[out]";
    }

    args.push(
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      outputFile
    );

    const ffmpeg = spawn(ffmpegPath, args);

    ffmpeg.stderr.on("data", (data) => {
      console.log(`FFmpeg: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(outputFile);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

export async function mergeAndDownloadVideo(meetingId){

  
  try {
    // 1. Fetch meeting videos from Cloudinary
    const videos = await getMeetingVideos(meetingId);
    console.log("videos");
    console.log(videos);

    if (videos.length < 2) {
      throw new Error("need atleat 2 videos to donwload ");
    }

    // 2. Run ffmpeg
    const outputFile = path.join(__dirname, `grid_${meetingId}.mp4`);
    await runFFmpeg(videos, outputFile);

    // 3. Send file as download
    return outputFile;
  } catch (err) {
    console.error("Error merging videos:", err); 
    // throw err;
  }
}