# Database Upgrade Error Fix

## Error Message
```
DexieError: UpgradeError - Not yet support for changing primary key
```

## What Happened?

The IndexedDB schema was updated to add a compound index `[meetingId+segmentIndex]` to prevent duplicate segments. However, if you had an older version of the database, Dexie cannot automatically upgrade it.

## Automatic Fix (Implemented)

The code now automatically detects this error and:
1. Deletes the old database
2. Creates a new one with the correct schema
3. Shows an alert to the user

```javascript
db.open().catch(async (err) => {
  if (err.name === 'UpgradeError') {
    console.warn("⚠️ Database upgrade error detected. Clearing database...");
    await db.delete();
    await db.open();
    alert("Database was upgraded. Any unsaved recordings have been cleared.");
  }
});
```

## Manual Fix (If Needed)

If the automatic fix doesn't work, users can manually clear the database:

### Option 1: Clear Browser Data (Recommended)
1. Open browser DevTools (F12)
2. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
3. Find "IndexedDB" in the left sidebar
4. Right-click on "myDatabase"
5. Click "Delete database"
6. Refresh the page

### Option 2: Clear All Site Data
1. Open browser DevTools (F12)
2. Go to "Application" tab
3. Click "Clear storage" in the left sidebar
4. Click "Clear site data"
5. Refresh the page

### Option 3: Use Console
1. Open browser DevTools (F12)
2. Go to "Console" tab
3. Run this command:
```javascript
indexedDB.deleteDatabase('myDatabase');
```
4. Refresh the page

## Impact

⚠️ **Warning:** Clearing the database will delete any segments that haven't been uploaded yet.

**Before clearing:**
- If you have recordings in progress, upload them first
- Check the dashboard to see if any meetings have pending uploads
- Click the upload button to upload all segments

**After clearing:**
- Database will be recreated with the new schema
- You can start recording again
- No data loss for already uploaded segments (they're on Cloudinary)

## Prevention

This error should only happen once during the upgrade. After the database is recreated with the new schema, it won't happen again.

## Schema Changes

### Version 5 (Old)
```javascript
db.version(5).stores({
  chunks: "++id, userId, meetingId, segmentIndex, timestamp, retries, uploaded"
});
```

### Version 6 (New)
```javascript
db.version(6).stores({
  chunks: "++id, userId, meetingId, segmentIndex, [meetingId+segmentIndex], timestamp, retries, uploaded"
});
```

**What changed:**
- Added compound index `[meetingId+segmentIndex]`
- This prevents duplicate segments with same meetingId and segmentIndex
- Primary key `++id` remains unchanged (auto-increment)

## Technical Details

### Why This Error Occurs

Dexie.js doesn't support changing the primary key of an existing table. The error occurred because:

1. Version 5 had: `++id` (auto-increment primary key)
2. Version 6 tried to change to: `id` (non-auto-increment)
3. Dexie rejected this change

### The Fix

Keep the same primary key across versions:
- Version 5: `++id`
- Version 6: `++id` (same!)
- Only add new indexes, don't change primary key

### Dexie Upgrade Rules

✅ **Allowed:**
- Adding new indexes
- Adding new tables
- Removing indexes

❌ **Not Allowed:**
- Changing primary key
- Changing auto-increment behavior
- Renaming tables

## Testing

To test the automatic fix:

1. Open DevTools Console
2. Run: `indexedDB.deleteDatabase('myDatabase')`
3. Refresh page
4. Database should be recreated automatically
5. Check console for success messages

## Support

If users continue to see this error after the automatic fix:
1. Ask them to manually clear browser data
2. Check if they're using an old browser version
3. Verify Dexie.js version is up to date
4. Check browser console for additional errors
