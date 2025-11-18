import { io } from "socket.io-client";

const socket = io("https://streamapp-webapp.onrender.com", {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
});

export default socket;