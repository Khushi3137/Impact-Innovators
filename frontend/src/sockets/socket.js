import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
const socketUrl = apiUrl.replace(/\/api\/?$/, "");

export const socket = io(socketUrl, {
  withCredentials: true,
  autoConnect: false,
});
