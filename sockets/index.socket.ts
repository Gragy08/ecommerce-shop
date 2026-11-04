import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { authSocket } from "./auth.socket";

export const initSocket = (io: Server) => {
  io.use(authSocket);

  // Danh sách tài khoản online
  const listAdminOnline = new Map();
  const listUserOnline = new Map();

  io.on('connection', (socket) => {
    // Thêm vào danh sách online
    if(socket.data.account?.role == "admin") {
      listAdminOnline.set(socket.data.account.id, 1);
      socket.emit("LIST_USER_ONLINE", {
        listUserOnline: Array.from(listUserOnline.keys())
      })
    } else if (socket.data.account?.role == "user") {
      listUserOnline.set(socket.data.account.id, 1);
      socket.broadcast.emit("USER_STATUS_ONLINE", {
        id: socket.data.account.id,
        status: "online"
      })
    }

    socket.on("disconnect", () => {
      if(socket.data.account?.role =="admin") {
        listAdminOnline.delete(socket.data.account.id);
      } else if (socket.data.account?.role == "user") {
        listUserOnline.delete(socket.data.account.id);
        socket.broadcast.emit("USER_STATUS_ONLINE", {
          id: socket.data.account.id,
          status: "offline"
        })
      }
    });

    // Chat Socket
    chatSocket(io, socket, listAdminOnline);
  });
}
