import { io } from "socket.io-client";

const socket = io("https://streamapp-uyjv.onrender.com", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});
export default socket;
