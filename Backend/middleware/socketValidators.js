// Socket event validation helpers

export function validateJoinMeeting(data) {
    const errors = [];
    
    if (!data.meetingId || typeof data.meetingId !== 'string') {
        errors.push('meetingId is required and must be a string');
    } else if (data.meetingId.length < 3 || data.meetingId.length > 100) {
        errors.push('meetingId must be between 3-100 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.meetingId)) {
        errors.push('meetingId contains invalid characters');
    }
    
    if (!data.userId || typeof data.userId !== 'string') {
        errors.push('userId is required and must be a string');
    } else if (data.userId.length < 3 || data.userId.length > 100) {
        errors.push('userId must be between 3-100 characters');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

export function validateLeaveMeeting(data) {
    const errors = [];
    
    if (!data.meetingId || typeof data.meetingId !== 'string') {
        errors.push('meetingId is required and must be a string');
    } else if (data.meetingId.length < 3 || data.meetingId.length > 100) {
        errors.push('meetingId must be between 3-100 characters');
    }
    
    if (!data.userId || typeof data.userId !== 'string') {
        errors.push('userId is required and must be a string');
    } else if (data.userId.length < 3 || data.userId.length > 100) {
        errors.push('userId must be between 3-100 characters');
    }
    
    if (data.lastSegmentIndex !== undefined) {
        if (typeof data.lastSegmentIndex !== 'number') {
            errors.push('lastSegmentIndex must be a number');
        } else if (data.lastSegmentIndex < -1 || data.lastSegmentIndex > 100000) {
            errors.push('lastSegmentIndex out of valid range');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

export function validateRecordingEvent(meetingId) {
    const errors = [];
    
    if (!meetingId || typeof meetingId !== 'string') {
        errors.push('meetingId is required and must be a string');
    } else if (meetingId.length < 3 || meetingId.length > 100) {
        errors.push('meetingId must be between 3-100 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(meetingId)) {
        errors.push('meetingId contains invalid characters');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
