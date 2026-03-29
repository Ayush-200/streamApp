# FFmpeg Worker Service Specification

This document specifies the expected behavior for the external FFmpeg worker service that processes video merging.

## Endpoint: POST /stitch

### Request Body
```json
{
  "videoUrls": ["url1", "url2"],
  "sessions": {
    "user1": [
      { "sessionId": "user1_1", "start": 0.00, "end": 45.23 },
      { "sessionId": "user1_2", "start": 50.15, "end": 120.50 }
    ],
    "user2": [
      { "sessionId": "user2_1", "start": 5.10, "end": 125.00 }
    ]
  },
  "options": {
    "useAudioMixing": true,
    "reEncode": true,
    "avSync": true,
    "minSegmentDuration": 0.1
  }
}
```

### Required FFmpeg Implementation

#### 1. Audio Mixing (amix)
When combining two video streams, use the `amix` filter to properly mix audio tracks:
```bash
ffmpeg -i video1.mp4 -i video2.mp4 \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest[aout]" \
  -map 0:v -map 1:v -map "[aout]" output.mp4
```

#### 2. Re-encoding for Precise Cuts
**DO NOT use `-c copy`** for video segments. Use re-encoding to ensure frame-accurate cuts:
```bash
# BAD (frame-inaccurate):
ffmpeg -ss 10.5 -to 45.23 -i input.mp4 -c copy output.mp4

# GOOD (frame-accurate):
ffmpeg -ss 10.5 -to 45.23 -i input.mp4 -c:v libx264 -c:a aac output.mp4
```

#### 3. A/V Sync Flags
Add these flags to prevent audio/video desynchronization:
```bash
-avoid_negative_ts make_zero -fflags +genpts
```

Complete example:
```bash
ffmpeg -ss 10.5 -to 45.23 -i input.mp4 \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  -c:v libx264 -c:a aac \
  output.mp4
```

#### 4. Timestamp Rounding
All timestamps are already rounded to 2 decimals by the backend before sending to the worker.

#### 5. Segment Filtering
Segments shorter than 0.1 seconds are already filtered out by the backend before sending to the worker.

#### 6. Validation
The backend validates that video files are accessible before calling the worker. The worker should still handle errors gracefully.

### Response Format
```json
{
  "success": true,
  "url": "https://cloudinary.com/merged-video.mp4",
  "duration": 125.50,
  "processedSegments": 5
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Implementation Notes

### Video Cut Validation
The worker should reject video cuts shorter than 0.1 seconds:
```javascript
if (end - start < 0.1) {
  throw new Error(`Segment too short: ${end - start}s (minimum 0.1s required)`);
}
```

### Complete FFmpeg Command Example
```bash
# Step 1: Cut segments from each video (re-encode for precision)
ffmpeg -ss 0.00 -to 45.23 -i video1.mp4 \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  segment1.mp4

# Step 2: Combine videos with audio mixing
ffmpeg -i video1_cut.mp4 -i video2_cut.mp4 \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=2[aout]" \
  -map 0:v -map 1:v -map "[aout]" \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  merged_output.mp4
```

### Audio Mixing Parameters
- `inputs=2`: Number of audio inputs to mix
- `duration=longest`: Output duration matches longest input
- `dropout_transition=2`: Smooth transition when audio drops out (2 seconds)

### Encoding Parameters
- `-c:v libx264`: H.264 video codec
- `-preset fast`: Balance between speed and compression
- `-crf 23`: Constant Rate Factor (quality, 18-28 range, lower = better)
- `-c:a aac`: AAC audio codec
- `-b:a 128k`: Audio bitrate

## Testing Checklist
- [ ] Audio from both videos is properly mixed
- [ ] Video cuts are frame-accurate
- [ ] No A/V sync issues
- [ ] Timestamps are precise to 2 decimals
- [ ] Segments < 0.1s are rejected
- [ ] Invalid video URLs are handled gracefully
