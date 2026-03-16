import { db } from "../db/db";
import axios from 'axios';

let isUploading = false; // Prevent concurrent uploads

export async function appendBlob({ userEmail, meetingId, blob, chunkIndex }) {
    try {
        const id = await db.chunks.add({
            userId: userEmail,
            blob: blob,
            meetingId: meetingId,
            status: 0, // 0 = pending, 1 = uploaded
            timestamp: Date.now(),
            chunkIndex: chunkIndex,
            retries: 0
        });

        console.log(`✅ Chunk ${chunkIndex} added to IndexedDB with id = ${id}`);
        return id;
    } catch (error) {
        console.error("Error adding chunk to IndexedDB:", error);
        throw error;
    }
}

export async function uploadBlob() {
    // Prevent concurrent uploads
    if (isUploading) {
        console.log("Upload already in progress, skipping...");
        return;
    }

    const count = await db.chunks.where("status").equals(0).count();
    if (count > 0) {
        console.log(`📤 ${count} chunks pending upload`);
        await startUploading();
    } else {
        console.log("No pending chunks to upload");
    }
}

export const startUploading = async () => {
    if (isUploading) return;
    
    isUploading = true;
    
    try {
        const chunk = await db.chunks.where("status").equals(0).first();
        
        if (!chunk) {
            console.log("No pending chunks to upload");
            isUploading = false;
            return;
        }
        
        // Check retry limit
        if (chunk.retries > 3) {
            console.error(`❌ Chunk ${chunk.chunkIndex} failed after 3 retries, deleting from IndexedDB`);
            await db.chunks.delete(chunk.id);
            isUploading = false;
            // Try next chunk
            uploadBlob();
            return;
        }

        const { userId, blob, meetingId, chunkIndex } = chunk;
        
        console.log(`⬆️ Uploading chunk ${chunkIndex} (size: ${blob.size} bytes)...`);
        
        // Create FormData for blob upload
        const formData = new FormData();
        formData.append("file", blob, `chunk-${chunkIndex}.webm`);
        formData.append("userId", userId);
        formData.append("chunkIndex", chunkIndex);
        
        const response = await axios.post(
            `${import.meta.env.VITE_BACKEND_URL}/uploadChunk/${meetingId}`, 
            formData, 
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 30000 // 30 second timeout
            }
        );
        
        console.log(`✅ Chunk ${chunkIndex} uploaded successfully:`, response.data);
        
        // Delete from IndexedDB after successful upload
        await db.chunks.delete(chunk.id);
        
        isUploading = false;
        
        // Continue uploading next chunk
        uploadBlob();
        
    } catch (error) {
        console.error("❌ Error uploading chunk:", error);
        
        // Get the chunk again to update retries
        const chunk = await db.chunks.where("status").equals(0).first();
        if (chunk) {
            await db.chunks.update(chunk.id, { retries: chunk.retries + 1 });
            console.log(`Retry count for chunk ${chunk.chunkIndex}: ${chunk.retries + 1}`);
        }
        
        isUploading = false;
        
        // Retry after a delay
        setTimeout(() => uploadBlob(), 2000);
    }
}