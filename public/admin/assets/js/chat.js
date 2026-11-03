// Khởi tạo SocketIO bên Admin
const socket = io();

// Nhận tin nhắn từ server
socket.on("SERVER_SEND_MESSAGE", (data) => {
  console.log(data);
});