import cloudinary from "../config/cloudinaryClient.js";

export const uploadBlob = async (req, res) => {
    const { meetingId } = req.params;
    const { userId, chunkIndex } = req.body;
    const blob = req.file;

    if (!blob) {
        console.error("❌ No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`📤 Uploading segment ${chunkIndex} for ${meetingId} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);

    try {
        // Convert buffer to base64 for upload_large
        const base64Data = `data:${blob.mimetype};base64,${blob.buffer.toString('base64')}`;
        
        // Use upload_large which is optimized for large files
        const result = await cloudinary.uploader.upload_large(
            base64Data,
            {
                resource_type: "video",
                format: "webm",
                upload_preset: "THIS_IS_MY_PRESET",
                public_id: `recordings/${meetingId}/${userId}/segment_${chunkIndex}`,
                tags: [meetingId, userId],
                folder: `meeting_recordings/${meetingId}`,
                chunk_size: 6000000, // 6MB chunks for parallel upload
                timeout: 600000 // 10 minutes timeout
            }
        );

        console.log(`✅ Segment ${chunkIndex} uploaded to Cloudinary`);
        res.json({ success: true, url: result.secure_url, chunkIndex });
    } catch (err) {
        console.error(`❌ Upload error for segment ${chunkIndex}:`, err.message);
        
        const errorMessage = err.message || err.error?.message || 'Unknown error';
        res.status(500).json({ 
            error: `Error occurred in uploading video: ${errorMessage}`,
            errorType: err.name || 'Error',
            details: {
                message: err.message,
                http_code: err.http_code,
                error: err.error
            }
        });
    }
}
