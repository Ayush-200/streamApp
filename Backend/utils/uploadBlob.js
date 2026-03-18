import cloudinary from "../config/cloudinaryClient.js";

export const uploadBlob = async (req, res) => {
    const { meetingId } = req.params;
    const { userId, chunkIndex } = req.body;
    const blob = req.file;

    console.log(`📥 Upload request - Meeting: ${meetingId}, User: ${userId}, Chunk: ${chunkIndex}`);

    if (!blob) {
        console.error("❌ No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify what multer received
    console.log("=== MULTER FILE INFO ===");
    console.log("originalname:", blob.originalname);
    console.log("mimetype:", blob.mimetype);
    console.log("size:", blob.size);
    console.log("buffer length:", blob.buffer.length);
    console.log("First 20 bytes:", blob.buffer.slice(0, 20));
    console.log("========================");

    console.log(`File received - Size: ${blob.size} bytes, Type: ${blob.mimetype}`);

    try {
        // Convert buffer to base64 for upload_large
        const base64Data = `data:${blob.mimetype};base64,${blob.buffer.toString('base64')}`;
        
        console.log(`📤 Using upload_large for better handling of video segments`);
        
        // Use upload_large which is optimized for large files and supports parallel chunk processing
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

        console.log(`✅ Upload successful - URL: ${result.secure_url}`);
        res.json({ success: true, url: result.secure_url, chunkIndex });
    } catch (err) {
        console.error(`❌ Error in uploadBlob:`);
        console.error('Error type:', typeof err);
        console.error('Error keys:', Object.keys(err));
        console.error('Full error:', JSON.stringify(err, null, 2));
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        
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
