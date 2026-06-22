import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection = null;
let queue = null;
let redisAvailable = false;

// Initialize Redis connection with error handling
try {
    if (process.env.REDIS_URL) {
        connection = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.warn('⚠️ Redis connection failed after 3 attempts. Video processing queue disabled.');
                    return null;
                }
                return Math.min(times * 100, 2000);
            },
            reconnectOnError: (err) => {
                console.error('Redis connection error:', err.message);
                return false;
            }
        });

        connection.on('connect', () => {
            console.log('✅ Redis connected');
            redisAvailable = true;
        });

        connection.on('error', (err) => {
            console.error('❌ Redis error:', err.message);
            redisAvailable = false;
        });

        queue = new Queue("jobs", { connection });
    } else {
        console.warn('⚠️ REDIS_URL not configured. Video processing queue disabled.');
    }
} catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    console.warn('⚠️ Video processing queue disabled. Recordings will be saved but not merged.');
}

export const addJobToQueue = async (meetingId) => {
    if (!redisAvailable || !queue) {
        console.warn(`⚠️ Redis unavailable. Cannot queue video processing for ${meetingId}`);
        return;
    }
    
    try {
        await queue.add('mergeMeeting', meetingId);
        console.log("Job added to queue:", meetingId);
    } catch (error) {
        console.error(`❌ Failed to add job to queue:`, error.message);
    }
};

export const deleteQueue = async (meetingId) => {
    if (!redisAvailable || !queue) {
        return;
    }
    
    try {
        const job = await queue.getJob(meetingId);
        if (job) {
            await job.remove();
            console.log("Job removed from queue:", meetingId);
        }
    } catch (error) {
        console.error(`❌ Failed to remove job from queue:`, error.message);
    }
};

export { connection, queue };



