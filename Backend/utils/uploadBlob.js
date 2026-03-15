import cloudinary from "../config/cloudinaryClient.js";

export const uploadBlob = async (req, res) => {
    const { meetingId } = req.params;
    const { userId, chunkIndex } = req.body;
    const blob = req.file;

    if (!blob) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        // cloudinary.uploader.upload expects a file path or base64 string, not buffer
        // For buffer, we need to use upload_stream
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: "video",
                    public_id: `recordings/${meetingId}/${userId}/chunk_${chunkIndex}`,
                    tags: [meetingId, userId]
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(blob.buffer);
        });

        res.json({ success: true, url: result.secure_url });
    } catch (err) {
        console.error(`Error occurred in uploading video: ${err}`);
        res.status(500).json({ error: `Error occurred in uploading video: ${err.message}` });
    }
}
