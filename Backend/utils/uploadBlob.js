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

    console.log(`File received - Size: ${blob.size} bytes, Type: ${blob.mimetype}`);

    try {
        // cloudinary.uploader.upload expects a file path or base64 string, not buffer
        // For buffer, we need to use upload_stream
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "video",
                    format: "webm",
                    upload_preset: "THIS_IS_MY_PRESET",
                    public_id: `recordings/${meetingId}/${userId}/chunk_${chunkIndex}`,
                    tags: [meetingId, userId],
                    folder: `meeting_recordings/${meetingId}`,
                    chunk_size: 6000000 // 6MB chunks for large files
                },
                (error, result) => {
                    if (error) {
                        console.error("❌ Cloudinary upload error:", error);
                        reject(error);
                    } else {
                        console.log(`✅ Chunk ${chunkIndex} uploaded to Cloudinary`);
                        resolve(result);
                    }
                }
            );
            
            // Write the buffer to the stream
            uploadStream.end(blob.buffer);
        });

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
