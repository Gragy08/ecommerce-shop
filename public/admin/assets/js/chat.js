// Logic nhắn tin của Admin
const formChat = document.querySelector("[form-chat]");
if(formChat) {
  const inputContent = formChat.querySelector("[input-content]");
  const buttonSend = formChat.querySelector("[button-send]");
  const chatRoomId = document.querySelector("[chat-room-id]").getAttribute("chat-room-id");
  const chatDetail = document.querySelector(".chat-detail");
  const chatBody = document.querySelector(".chat-body");

  // Khởi tạo SocketIO bên Admin
  const socket = io({
    auth: {
      roomId: chatRoomId
    }
  });

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

  // Hàm hiển thị tin nhắn
  const appendMessage = (item, isPrepend = false) => {
    const elementMessage = document.createElement("div");
    elementMessage.classList.add("d-flex");
    if(item.senderRole == "admin") {
      elementMessage.classList.add("flex-row-reverse");
    }
    elementMessage.setAttribute("id", item._id);
    elementMessage.innerHTML = `
      <div class="chat-box w-100 ${item.senderRole === 'admin' ? 'reverse' : ''}">
        <div class="user-chat" title="${item.createdAtFormat}">
          <p>${item.content}</p>
        </div>
      </div>
    `;
    if(isPrepend) {
      chatDetail.prepend(elementMessage);
    } else {
      chatDetail.appendChild(elementMessage);
    }
  }

  // Nhận tin nhắn từ server
  socket.on("SERVER_SEND_MESSAGE", (data) => {
    if(chatRoomId == data.roomId) {
      appendMessage(data);
    }
  });

  // Load 20 tin nhắn gần nhất
  const loadInitialMessages = async () => {
    const res = await fetch(`/${pathAdmin}/chat/messages?limit=20&roomId=${chatRoomId}`);
    const data = await res.json();
    
    for (const item of data.messages) {
      appendMessage(item);
    }

    // Khi mở chat scroll xuống tin nhắn mới nhất
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  loadInitialMessages();

  // Khi scorll lên load thêm những tin nhắn cũ
  let isLoading = false;
  let hasMore = true;
  chatBody.addEventListener("scroll", async () => {
    if (chatBody.scrollTop === 0 && !isLoading && hasMore) {
      isLoading = true;

      const lastMessage = chatBody.querySelector(".d-flex");
      const lastMessageId = lastMessage.getAttribute("id");

      if (!lastMessageId) return;

      const res = await fetch(`/${pathAdmin}/chat/messages?lastMessageId=${lastMessageId}&limit=20&roomId=${chatRoomId}`);
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

  // Lắng nghe sự kiện USER_STATUS_ONLINE
  socket.on("USER_STATUS_ONLINE", (data) => {
    const elementUserOnlineBoxLeft = document.querySelector(`.chat-body-left [user-id="${data.id}"] [user-status]`);
    if(elementUserOnlineBoxLeft) {
      if(data.status == "online") {
      elementUserOnlineBoxLeft.classList.remove("d-none");
      } else if (data.status == "offline") {
        elementUserOnlineBoxLeft.classList.add("d-none");
      }
    }
  });

  // Danh sách user đang online
  socket.on("LIST_USER_ONLINE", (data) => {
    data.listUserOnline.forEach(id => {
      const elementUserOnlineBoxLeft = document.querySelector(`.chat-body-left [user-id="${id}"] [user-status]`);
      if(elementUserOnlineBoxLeft) {
        elementUserOnlineBoxLeft.classList.remove("d-none");
      }
    });
  });
}
