import { body, param, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed',
            details: errors.array() 
        });
    }
    next();
};

// Meeting ID validation rules
export const validateMeetingId = [
    param('meetingId')
        .trim()
        .notEmpty().withMessage('Meeting ID is required')
        .isLength({ min: 3, max: 100 }).withMessage('Meeting ID must be between 3-100 characters')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Meeting ID can only contain letters, numbers, hyphens, and underscores'),
    handleValidationErrors
];

// Meeting name validation rules
export const validateMeetingName = [
    param('meetingName')
        .trim()
        .notEmpty().withMessage('Meeting name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Meeting name must be between 3-100 characters')
        .matches(/^[a-zA-Z0-9\s_-]+$/).withMessage('Meeting name contains invalid characters'),
    handleValidationErrors
];

// User ID validation rules
export const validateUserId = [
    param('userId')
        .trim()
        .notEmpty().withMessage('User ID is required')
        .isLength({ min: 3, max: 100 }).withMessage('User ID must be between 3-100 characters'),
    handleValidationErrors
];

// Email validation rules
export const validateEmail = [
    param('emailId')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    handleValidationErrors
];

// Upload meeting validation
export const validateUploadMeeting = [
    param('meetingId')
        .trim()
        .notEmpty().withMessage('Meeting ID is required')
        .isLength({ min: 3, max: 100 }).withMessage('Invalid meeting ID length'),
    body('userId')
        .trim()
        .notEmpty().withMessage('User ID is required')
        .isLength({ min: 3, max: 100 }).withMessage('Invalid user ID length'),
    body('videoPublicId')
        .trim()
        .notEmpty().withMessage('Video public ID is required')
        .isLength({ min: 5, max: 500 }).withMessage('Invalid video public ID'),
    handleValidationErrors
];

// Add user meeting validation
export const validateAddUserMeeting = [
    param('emailId')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('newMeeting')
        .trim()
        .notEmpty().withMessage('Meeting name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Meeting name must be between 3-100 characters'),
    body('newDate')
        .notEmpty().withMessage('Date is required')
        .isISO8601().withMessage('Invalid date format'),
    handleValidationErrors
];

// Remove meeting from schedule validation
export const validateRemoveMeeting = [
    param('emailId')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('meetingToRemove')
        .trim()
        .notEmpty().withMessage('Meeting to remove is required'),
    handleValidationErrors
];

// Get last segment index validation
export const validateGetLastSegment = [
    param('meetingName')
        .trim()
        .notEmpty().withMessage('Meeting name is required'),
    param('userId')
        .trim()
        .notEmpty().withMessage('User ID is required'),
    handleValidationErrors
];

// Scheduled meeting validation rules
export const validateScheduleMeeting = [
    param('userId')
        .trim()
        .notEmpty().withMessage('User ID is required')
        .isEmail().withMessage('User ID must be a valid email'),
    body('meetingName')
        .trim()
        .notEmpty().withMessage('Meeting name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Meeting name must be between 3-100 characters')
        .matches(/^[a-zA-Z0-9\s_-]+$/).withMessage('Meeting name contains invalid characters'),
    body('scheduledDate')
        .notEmpty().withMessage('Scheduled date is required')
        .isISO8601().withMessage('Invalid date format'),
    body('scheduledTime')
        .notEmpty().withMessage('Scheduled time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
    body('description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    handleValidationErrors
];

export const validateUploadComplete = [
    param('meetingId')
        .trim()
        .notEmpty().withMessage('Meeting ID is required'),
    body('userId')
        .trim()
        .notEmpty().withMessage('User ID is required'),
    handleValidationErrors
];

export const validateGetScheduledMeetings = [
    param('userId')
        .trim()
        .notEmpty().withMessage('User ID is required')
        .isEmail().withMessage('User ID must be a valid email'),
    handleValidationErrors
];

export const validateDeleteScheduledMeeting = [
    param('meetingId')
        .trim()
        .notEmpty().withMessage('Meeting ID is required')
        .isMongoId().withMessage('Invalid meeting ID format'),
    handleValidationErrors
];
