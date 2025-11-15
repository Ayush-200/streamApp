import express from 'express';
const app = express();
import cors from 'cors';
import router from './routes/route.js';
import dotenv from 'dotenv';
import http from 'http';
const server = http.createServer(app);
import connectDB from './MongoDB/db.js'
import { Server } from 'socket.io';
import { v2 as cloudinary } from 'cloudinary';
import { socketHandler } from './controller/socketHandler.js';

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

dotenv.config();
const port = process.env.PORT || 3000;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Log the configuration
console.log(cloudinary.config());

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