import express from 'express';
import { StreamClient } from "@stream-io/node-sdk";
import { User } from '../MongoDB/model.js';
import dotenv from 'dotenv';
import { addUsersMeetings } from '../services/addUserMeeting.js';

dotenv.config();

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const client = new StreamClient(apiKey, apiSecret);
const ffmpegUrl = process.env.FFMPEG_WORKER_URL;

export const addUsersMeetings = (async (req, res) => {
    const email = req.params.emailId;
    const { newMeeting, newDate } = req.body;

    try {
        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            {
                $push: {
                    meeting: newMeeting,
                    date: newDate
                }
            },
            { new: true, upsert: true }
        );
        res.json(updatedUser);
    } catch (err) {
        console.log("error in adding new meeting", err);
        res.status(500).json({ message: "Error adding meeting" });
    }
})