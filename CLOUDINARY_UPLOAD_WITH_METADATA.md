# 📹 Cloudinary Upload with Participant Metadata - Implementation

## ✅ **Feature Implemented**

When a user's recording gets uploaded, it now:
1. ✅ Uploads to Cloudinary with metadata (joinTime, leaveTime, uploadTime)
2. ✅ Updates participant record with leaveTime and videoPublicId
3. ✅ Deletes the participant record from MeetingParticipantDB after successful upload

---

## 🔧 **Changes Made**

### **1. Frontend - `recording.js`**

#### **Added:**
- `currentUserEmail` variable to track user email
- `userEmail` parameter to `startRecording()` function
- `userEmail` parameter to `uploadRecording()` and `uploadRecordingWithKeepalive()`
- User email is now sent with the upload FormData

#### **Key Changes:**
```javascript
// Store user email when recording starts
currentUserEmail = userEmail;

// Send userEmail with upload
formData.append("userEmail", userEmail);
```

---

### **2. Frontend - `MeetingUI.jsx`**

#### **Updated:**
- `startRecording()` now receives `user?.email` as second parameter

```javascript
socket.on("start_recording", () => {
  startRecording(meetingName, user?.email);
});
```

---

### **3. Backend - `route.js`**

#### **Major Updates:**

1. **Extract userEmail from request:**
   ```javascript
   const userEmail = req.body.userEmail;
   const leaveTime = new Date(); // Time when user left
   const uploadTime = new Date(); // Time when uploading
   ```

2. **Find participant record:**
   ```javascript
   const meetingParticipant = await MeetingParticipantDB.findOne({ meetingId });
   const participantRecord = meetingParticipant.participants.find(
     p => p.userId === userEmail
   );
   const joinTime = participantRecord.joinTime;
   ```

3. **Upload to Cloudinary with metadata:**
   ```javascript
   const cloudinaryResult = await cloudinary.uploader.upload(file, {
     resource_type: "video",
     tags: [meetingId, userEmail],
     context: {
       meetingId: meetingId,
       userEmail: userEmail,
       joinTime: joinTime.toISOString(),
       leaveTime: leaveTime.toISOString(),
       uploadTime: uploadTime.toISOString()
     }
   });
   ```

4. **Update and delete participant record:**
   ```javascript
   // Update with leaveTime and videoPublicId
   await MeetingParticipantDB.findOneAndUpdate(
     { meetingId, "participants.userId": userEmail },
     {
       $set: {
         "participants.$.leaveTime": leaveTime,
         "participants.$.videoPublicId": cloudinaryResult.public_id
       }
     }
   );

   // Delete participant from array
   await MeetingParticipantDB.findOneAndUpdate(
     { meetingId },
     { $pull: { participants: { userId: userEmail } } }
   );
   ```

---

## 📊 **Data Flow**

```
1. User starts recording
   ↓
2. Frontend: startRecording(meetingName, userEmail)
   ↓
3. User leaves meeting (or stops recording)
   ↓
4. Frontend: uploadRecording(blob, meetingName, userEmail)
   ↓
5. Backend receives upload with userEmail
   ↓
6. Backend finds participant in MeetingParticipantDB
   ↓
7. Backend gets joinTime from participant record
   ↓
8. Backend sets leaveTime = current time
   ↓
9. Backend uploads to Cloudinary with metadata:
   - joinTime (from DB)
   - leaveTime (current time)
   - uploadTime (current time)
   ↓
10. Backend updates participant with leaveTime & videoPublicId
   ↓
11. Backend deletes participant record from array
   ↓
12. Response sent with all metadata
```

---

## 🗄️ **Database Schema**

### **MeetingParticipantDB Structure:**
```javascript
{
  meetingId: String,
  participants: [
    {
      userId: String,        // userEmail
      joinTime: Date,        // When user joined
      leaveTime: Date,       // When user left (set on upload)
      videoPublicId: String // Cloudinary public_id (set on upload)
    }
  ]
}
```

### **What Happens:**
1. **On Join:** Participant added with `joinTime`
2. **On Upload:** 
   - `leaveTime` is set
   - `videoPublicId` is set
   - Participant is **deleted** from array

---

## ☁️ **Cloudinary Metadata**

### **Tags:**
- `meetingId` - For filtering videos by meeting
- `userEmail` - For filtering videos by user

### **Context (Metadata):**
```javascript
{
  meetingId: "meeting-123",
  userEmail: "user@example.com",
  joinTime: "2024-01-15T10:00:00.000Z",
  leaveTime: "2024-01-15T10:30:00.000Z",
  uploadTime: "2024-01-15T10:30:05.000Z"
}
```

### **Accessing Metadata:**
```javascript
// In Cloudinary dashboard or API
const result = await cloudinary.api.resource('video-1234567890', {
  resource_type: 'video'
});

console.log(result.context);
// {
//   meetingId: "meeting-123",
//   userEmail: "user@example.com",
//   joinTime: "2024-01-15T10:00:00.000Z",
//   leaveTime: "2024-01-15T10:30:00.000Z",
//   uploadTime: "2024-01-15T10:30:05.000Z"
// }
```

---

## ✅ **Features**

### **1. Automatic Metadata Collection:**
- ✅ Join time from database
- ✅ Leave time (when upload happens)
- ✅ Upload time (when video uploaded to Cloudinary)

### **2. Participant Management:**
- ✅ Participant record updated with leaveTime
- ✅ Video public_id stored in participant record
- ✅ Participant record deleted after upload

### **3. Error Handling:**
- ✅ Try-catch blocks for all async operations
- ✅ Proper error responses
- ✅ Logging for debugging

---

## 🔍 **Response Format**

### **Success Response:**
```json
{
  "success": true,
  "fileName": "1757494277860-user-1757494277755.webm",
  "cloudinaryPublicId": "video-1234567890",
  "joinTime": "2024-01-15T10:00:00.000Z",
  "leaveTime": "2024-01-15T10:30:00.000Z",
  "uploadTime": "2024-01-15T10:30:05.000Z"
}
```

### **Error Response:**
```json
{
  "success": false,
  "message": "Error uploading video",
  "error": "Error message details"
}
```

---

## 🧪 **Testing Checklist**

- [ ] User joins meeting → Participant record created with joinTime
- [ ] User starts recording → userEmail stored
- [ ] User leaves meeting → Video uploaded with userEmail
- [ ] Backend finds participant record → Gets joinTime
- [ ] Cloudinary upload → Metadata includes joinTime, leaveTime, uploadTime
- [ ] Participant record updated → leaveTime and videoPublicId set
- [ ] Participant record deleted → Removed from participants array
- [ ] Response includes all metadata → joinTime, leaveTime, uploadTime

---

## 📝 **Notes**

1. **Timing:**
   - `joinTime`: From database (when user joined)
   - `leaveTime`: Set when upload happens (user left)
   - `uploadTime`: Set when upload happens (video uploaded)

2. **Participant Deletion:**
   - Participant is deleted **after** successful Cloudinary upload
   - If upload fails, participant record remains (for retry)

3. **Missing userEmail:**
   - If userEmail is not provided, upload still works
   - Metadata will have `userEmail: 'unknown'`
   - Participant record won't be updated/deleted

4. **Multiple Uploads:**
   - If same user uploads multiple times, only latest participant record is handled
   - Each upload creates a new Cloudinary video

---

## 🚀 **Future Enhancements**

1. **Retry Logic:** If upload fails, retry with same metadata
2. **Batch Upload:** Handle multiple participants at once
3. **Video Validation:** Check video quality before upload
4. **Progress Tracking:** Show upload progress to user
5. **Analytics:** Track upload times and success rates

