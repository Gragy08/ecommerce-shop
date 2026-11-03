import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { authSocket } from "./auth.socket";

export const initSocket = (io: Server) => {
  io.use(authSocket);

  io.on('connection', (socket) => {
    // Chat Socket
    chatSocket(io, socket);
  });
}
