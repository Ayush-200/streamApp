import { db } from "../db/db";
import { v2 as cloudinary } from 'cloudinary';


cloudinary.config({
  cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET
});


export function appendBlob(blob, meetingId, userId, chunkIndex) {
    const id = db.chunks.add({
        userId: userId,
        blob: blob,
        meetingId: meetingId,
        uploaded: false,
        timestamp: Date.now(),
        chunkIndex: chunkIndex,
        retries: 0
    })

    console.log(`blob added to indexDB with id = ${id}`);
}

export function uploadBlob() {
    const count = db.chunks.where("uploaded").equals(false).count();
    if (count > 0) {
        console.log(`${count} chunks are pending`);
        startUploading();
    }
}

export const startUploading = async () => {
    const chunk = await db.chunks.where("uploaded").equals(false).first();
    try {
        // upload chunk.blob to server with meetingId and userId
        
        if (chunk.retries > 3) {
            console.error(`chunk with id ${chunk.id} has failed to upload after 3 retries, deleting it from indexDB`);
            await db.chunks.delete(chunk.id);
            return;
        }

        const  { userId, blob, meetingId, chunkIndex } = chunk;
        await cloudinary.uploader.upload(blob, {
            resource_type: "video",
            public_id: `recordings/${meetingId}/${userId}/chunk_${chunkIndex}`,
            tags: [meetingId, userId]
        });

        chunk.upload = true;

        await db.chunks.delete(chunk.id);
        console.log(`chunk with id ${chunk.id} uploaded and deleted from indexDB`);
        return;
    }

    catch (error) {
    chunk.retries += 1;
    console.error("Error uploading chunk", error);
    }
}