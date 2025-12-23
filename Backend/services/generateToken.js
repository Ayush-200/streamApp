import { StreamClient } from "@stream-io/node-sdk";
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const client = new StreamClient(apiKey, apiSecret);

export const generateUserToken = (async(req, res) => {
    const userId = req.params.userId;
    const validity = 24 * 60 * 60;
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: validity });
    res.json({ token });
})
