import { io } from "socket.io-client";

let socket = null;

export function initializeSocket(token) {
  if (socket && socket.connected) {
    return socket;
  }
  
  socket = io(import.meta.env.VITE_BACKEND_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    auth: {
      token
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
    if (reason === "io server disconnect") {
      socket.connect();
    }
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("Socket reconnected after", attemptNumber, "attempts");
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log("Socket reconnection attempt:", attemptNumber);
  });

  socket.on("reconnect_error", (error) => {
    console.error("Socket reconnection error:", error);
  });

  socket.on("reconnect_failed", () => {
    console.error("Socket reconnection failed after all attempts");
  });
  
  return socket;
}

export function getSocket() {
  return socket;
}

export default { initializeSocket, getSocket };
