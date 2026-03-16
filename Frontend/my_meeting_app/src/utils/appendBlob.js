import { db } from "../db/db";

export async function appendBlob({ userEmail, meetingId, blob, chunkIndex, segmentIndex }) {
    try {
        const id = await db.chunks.add({
            userId: userEmail,
            blob: blob,
            meetingId: meetingId,
            segmentIndex: segmentIndex, // Which 60-second segment
            timestamp: Date.now(),
            chunkIndex: chunkIndex
        });

        console.log(`✅ Chunk ${chunkIndex} (segment ${segmentIndex}) added to IndexedDB with id = ${id}`);
        return id;
    } catch (error) {
        console.error("Error adding chunk to IndexedDB:", error);
        throw error;
    }
}