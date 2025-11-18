import express from 'express';
const app = express();
import cors from 'cors';
import router from './routes/route.js';
import dotenv from 'dotenv';
import http from 'http';
const server = http.createServer(app);
import connectDB from './MongoDB/db.js'
import { Server } from 'socket.io';
import cloudinary from './cloudinaryClient.js';
import { socketHandler } from './controller/socketHandler.js';

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"], 
    credentials: true
  }
});

dotenv.config();
const port = process.env.PORT || 3000;

// Cloudinary client is configured in ./cloudinaryClient.js
console.log('Cloudinary client loaded');

app.use(cors());
app.use(express.json());   // <-- This is important (for JSON body parsing)
app.use(express.urlencoded({ extended: true }));
connectDB();

socketHandler(io);

app.use('/', router);


server.listen(port, () =>{
    console.log("app is running on port 3000");
})
export default cloudinary;