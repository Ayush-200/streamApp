import { Worker } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
    host: "127.0.0.1",
    port: 6379
});

const worker = new Worker(
    "jobs",
    async (job) => {
        console.log("Processing job:", job.data);
        const response = await fetch(`${EC2_URL}/mergeMeeting`, {
            method: "POST",
            body: JSON.stringify(job.data)
        })
    },
    { connection }
);

