import { Worker } from "bullmq";
import { connection } from './queueService.js';

let worker = null;

// Only initialize worker if Redis connection is available
if (connection) {
    try {
        worker = new Worker(
            "jobs",
            async (job) => {
                console.log("Processing job:", job.data);
                const EC2_URL = process.env.FFMPEG_WORKER_URL;
                
                if (!EC2_URL) {
                    console.error('❌ FFMPEG_WORKER_URL not configured');
                    return;
                }
                
                try {
                    const response = await fetch(`${EC2_URL}/mergeMeeting`, {
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(job.data)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`FFmpeg worker returned ${response.status}`);
                    }
                    
                    console.log("✅ Video processing completed for:", job.data);
                } catch (error) {
                    console.error("❌ Video processing failed:", error.message);
                    throw error;
                }
            },
            { connection }
        );

        worker.on('completed', (job) => {
            console.log(`✅ Job ${job.id} completed`);
        });

        worker.on('failed', (job, err) => {
            console.error(`❌ Job ${job?.id} failed:`, err.message);
        });

        console.log('✅ Queue worker initialized');
    } catch (error) {
        console.error('❌ Failed to initialize queue worker:', error.message);
    }
} else {
    console.warn('⚠️ Queue worker disabled (Redis not available)');
}

export default worker;

