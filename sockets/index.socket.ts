import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";

export const initSocket = (io: Server) => {
  io.on('connection', (socket) => {
    // Chat Socket
    chatSocket(io, socket);
  });
}
