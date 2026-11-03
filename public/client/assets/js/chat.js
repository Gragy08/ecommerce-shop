// Khởi tạo SocketIO bên Client
const socket = io();

const chatButton = document.querySelector("#chat-button");

if(chatButton) {
  const chatPopup = document.querySelector("#chat-popup");
  const chatClose = document.querySelector("#chat-close");

  // Đóng/mở chat
  chatButton.addEventListener("click", () => {
    chatPopup.classList.toggle("hidden");
  });

  // Đóng chat
  chatClose.addEventListener("click", () => {
    chatPopup.classList.add("hidden");
  });

  // Gửi tin nhắn lên server
  const chatInput = document.querySelector("#chat-input");
  const chatSend = document.querySelector("#chat-send");
  chatSend.addEventListener("click", () => {
    const content = chatInput.value.trim();
    if (content) {
      socket.emit("CLIENT_SEND_MESSAGE", {
        content: content
      });
      chatInput.value = "";
    }
  });

  // Nhận tin nhắn từ server
  socket.on("SERVER_SEND_MESSAGE", (data) => {
    console.log(data);
  });
}