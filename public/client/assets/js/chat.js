// Khởi tạo SocketIO bên Client
const socket = io();

const chatButton = document.querySelector("#chat-button");

if(chatButton) {
  const chatPopup = document.querySelector("#chat-popup");
  const chatClose = document.querySelector("#chat-close");
  const chatBody = document.querySelector("#chat-body");

  // Đóng/mở chat
  chatButton.addEventListener("click", () => {
    chatPopup.classList.toggle("hidden");
    // Khi mở chat scroll xuống tin nhắn mới nhất
    if(!chatPopup.classList.contains("hidden")) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
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

  // Hàm hiển thị tin nhăn
  const appendMessage = (item) => {
    const elementMessage = document.createElement("div");
    elementMessage.classList.add("message");
    elementMessage.classList.add(item.senderRole);
    elementMessage.setAttribute("id", item._id);
    elementMessage.innerHTML = `
      <div class="bubble">${item.content}</div>
    `;
    chatBody.appendChild(elementMessage);
  }

  // Nhận tin nhắn từ server
  socket.on("SERVER_SEND_MESSAGE", (data) => {
    appendMessage(data);
    chatBody.scrollTop = chatBody.scrollHeight;
  });

  // Load 20 tin nhắn gần nhất
  const loadInitialMessages = async () => {
    const res = await fetch(`/chat/messages?limit=20`);
    const data = await res.json();
    
    for (const item of data.messages) {
      appendMessage(item);
    }
  }
  loadInitialMessages();
}