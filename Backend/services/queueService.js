import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379
});

const queue = new Queue("jobs", {
  connection
});

export const addJobToQueue = async (meetingId) => { 
    try{
        await queue.add('mergeMeeting', meetingId);
        console.log("job added to queue", meetingId);
    }catch(err){
        console.error('Error adding job to queue:', err);
    }
}

export const deleteQueue = async (meetingId) => {
    try{
        const job = await queue.getJob(meetingId);
        if(job){
            await job.remove();
        }
    }catch(err){
        console.error('Error deleting job from queue:', err);
    }
}



