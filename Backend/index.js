import express from 'express';
const app = express();
import cors from 'cors';
import router from './routes/route.js';
import dotenv from 'dotenv';
import http from 'http';
const server = http.createServer(app);
import connectDB from './MongoDB/db.js';
import { Server } from 'socket.io';
import cloudinary from './cloudinaryClient.js';
import { socketHandler } from './controller/socketHandler.js';

dotenv.config();
const port = process.env.PORT || 3000;

// ====== CORS FIX HERE ======
app.use(cors({
  origin: [
    "https://streamapp-webapp.onrender.com",
    "http://localhost:5173"
  ],
  credentials: true
}));

app.options("*", cors());   // allow preflight

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

const io = new Server(server, {
  cors: {
    origin: [
      "https://streamapp-webapp.onrender.com",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

socketHandler(io);

// Your routes
app.use('/', router);

server.listen(port, () => {
  console.log("app is running on port " + port);
});

export default cloudinary;
