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
  const appendMessage = (item, isPrepend = false) => {
    const elementMessage = document.createElement("div");
    elementMessage.classList.add("message");
    elementMessage.classList.add(item.senderRole);
    elementMessage.setAttribute("id", item._id);
    elementMessage.innerHTML = `
      <div class="bubble">${item.content}</div>
    `;
    // chatBody.appendChild(elementMessage);
    if (isPrepend) {
      chatBody.prepend(elementMessage);
    } else {
      chatBody.appendChild(elementMessage);
    }
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

  // Khi scorll lên load thêm những tin nhắn cũ
  let isLoading = false;
  let hasMore = true;

  chatbody.addEventListener("scroll", async () => {
    if (chatBody.scrollTop === 0 && !isLoading && hasMore) {
      isLoading = true;


      const lastMessage = chatBody.querySelector(".message");
      const lastMessageId = lastMessage.getAttribute("id");

      if (!lastMessageId) return;

      const res = await fetch(`/chat/messages?lastMessageId=${lastMessageId}&limit=20`);
      const data = await res.json();

      if (data.messages.length === 0) {
        hasMore = false;
      } else {
        const oldHeight = chatBody.scrollHeight;

        data.messages.forEach(item => {
          appendMessage(item, true);
        });

        const newHeight = chatBody.scrollHeight;

        // Giữ nguyên vị trí scroll
        chatBody.scrollTop = newHeight - oldHeight;
      }

      isLoading = false;
    }
  });
}