import express from 'express';
import cors from 'cors';
import router from './routes/route.js';
import dotenv from 'dotenv';
import http from 'http';
import connectDB from './MongoDB/db.js';
import { Server } from 'socket.io';
import { v2 as cloudinary } from 'cloudinary';
import { socketHandler } from './controller/socketHandler.js';

dotenv.config(); 

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ⭐ HEALTH CHECK ROUTE — VERY IMPORTANT FOR RENDER
app.get("/", (req, res) => {
  res.send("Backend working ✔");
});

// Load routes normally (NOT inside DB connect)
app.use('/', router);

// SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
socketHandler(io);

// CONNECT TO DB THEN START SERVER
connectDB()
  .then(() => {
    console.log("MongoDB connected!");

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });

export default cloudinary;