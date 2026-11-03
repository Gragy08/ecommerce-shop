// Khởi tạo SocketIO bên Admin
const socket = io();

// Logic nhắn tin của Admin
const formChat = document.querySelector("[form-chat]");
if(formChat) {
  const inputContent = formChat.querySelector("[input-content]");
  const buttonSend = formChat.querySelector("[button-send]");

  buttonSend.addEventListener("click", () => {
    const content = inputContent.value.trim();
    if(content) {
      // Gửi tin nhắn lên cho server
      socket.emit("CLIENT_SEND_MESSAGE", {
        content: content
      });
      inputContent.value = "";
    }
  })


  // Nhận tin nhắn từ server
  socket.on("SERVER_SEND_MESSAGE", (data) => {
    console.log(data);
  }); 
}