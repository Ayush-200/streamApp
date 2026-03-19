import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

socket.onclose = () => {
  console.log("Socket closed. Reconnecting...");
  setTimeout(connectWebSocket, 2000);
};

export default socket;
