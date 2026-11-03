import { Server, Socket } from "socket.io";

export const chatSocket = (io: Server, socket: Socket) => {
  // Lắng nghe sự kiện CLIENT_SEND_MESSAGE
  socket.on('CLIENT_SEND_MESSAGE', (data) => {
    // Phản hồi về cho tất cả mọi người
    io.emit('SERVER_SEND_MESSAGE', data);
  });
}
