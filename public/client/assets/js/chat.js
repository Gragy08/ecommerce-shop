// Khởi tạo SocketIO bên Client
const socket = io();

const chatButton = document.querySelector("#chat-button");

if(chatButton) {
  const chatPopup = document.querySelector("#chat-popup");
  const chatClose = document.querySelector("#chat-close");
  const chatBody = document.querySelector("#chat-body");
  const chatCount = chatButton.querySelector(".chat-count");
  const chatFile = document.querySelector("#chat-file");
  const chatAttach = document.querySelector("#chat-attach");
  const chatPreview = document.querySelector("#chat-preview");
  let selectedFiles = [];

  // Đóng/mở chat
  chatButton.addEventListener("click", () => {
    chatPopup.classList.toggle("hidden");
    // Khi mở chat scroll xuống tin nhắn mới nhất
    if(!chatPopup.classList.contains("hidden")) {
      chatBody.scrollTop = chatBody.scrollHeight;

      // Gửi lên server biết chat đang mở
      socket.emit("CLIENT_OPEN_CHAT", {
        isOpen: true
      });
      chatCount.innerHTML = "0";
    }
  });

  // Đóng chat
  chatClose.addEventListener("click", () => {
    chatPopup.classList.add("hidden");
  });

  // Gửi tin nhắn lên server
  const chatInput = document.querySelector("#chat-input");
  const chatSend = document.querySelector("#chat-send");
  chatSend.addEventListener("click", async () => {
    // Gửi files lên backend để lấy link file
    let fileUrls = [];
    if (selectedFiles.length > 0) {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });

      const res = await fetch("/chat/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.code === "success") {
        fileUrls = data.fileUrls;
      }
    }

    const content = chatInput.value.trim();

    if (content || fileUrls.length > 0) {
      socket.emit("CLIENT_SEND_MESSAGE", {
        content: content,
        files: fileUrls
      });
      chatInput.value = "";
      selectedFiles = [];
      chatPreview.innerHTML = "";
      chatPreview.classList.add("d-none");
    }
  });

  // Hàm hiển thị tin nhăn
  const appendMessage = (item, isPrepend = false) => {
    const elementMessage = document.createElement("div");
    elementMessage.classList.add("message");
    elementMessage.classList.add(item.senderRole);
    elementMessage.setAttribute("id", item._id);
    // elementMessage.innerHTML = `
    //   <div class="bubble">${item.content}</div>
    // `;
    let html = "";
    // Hiển thị content
    if (item.content) {
      html += `
        <div class="bubble">${item.content}</div>
      `;
    }
    // Hiển thị file
    if (item.files && item.files.length > 0) {
      html += `<div class="message-files">`;
      item.files.forEach(file => {
        const ext = file.split(".").pop().toLowerCase();
        if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
          html += `
            <a href="${domainCDN}${file}" target="_blank">
              <img src="${domainCDN}${file}" class="chat-image">
            </a>
          `;
        } else {
          html += `
            <a href="${domainCDN}${file}" target="_blank">
              📄 File đính kèm
            </a>
          `;
        }
      });
      html += `</div>`;
    }
    elementMessage.innerHTML = html;
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

    // Nếu chat đang đóng, tăng số lượng tin nhắn chưa đọc
    if(chatPopup.classList.contains("hidden")) {
      chatCount.innerHTML = parseInt(chatCount.innerHTML) + 1;
    } else {
      socket.emit("CLIENT_OPEN_CHAT", {
        isOpen: true
      });
      chatCount.innerHTML = "0";
    }
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

  chatBody.addEventListener("scroll", async () => {
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

  // Lắng nghe sự kiện SERVER_SEND_ADMIN_TYPING
  socket.on("SERVER_SEND_ADMIN_TYPING", (data) => {
    const { isTyping } = data;
    const chatTyping = document.querySelector("#chat-typing");
    chatTyping.style.display = isTyping ? "block" : "none";
  });

  // Click vào nút Attach
  chatAttach.addEventListener("click", () => {
    chatFile.click();
  });

  // Chọn file
  chatFile.addEventListener("change", (e) => {
    const files = Array.from(e.target.files); // Danh sách file từ dạng object chuyển thành dạnh mảng

    files.forEach(file => {
      selectedFiles.push(file);

      const reader = new FileReader(); // Khởi tạo đọc file

      const previewItem = document.createElement("div"); // Tạo phần preview
      previewItem.classList.add("preview-item"); // Thêm class preview-item cho phần preview

      // Nếu là ảnh thì hiển thị img
      if (file.type.startsWith("image/")) {
        reader.onload = (event) => { // Khi đọc file xảy ra sự kiện
          previewItem.innerHTML = `
            <img src="${event.target.result}" />
            <div class="preview-remove">×</div>
          `;
        };
        reader.readAsDataURL(file); // Đọc file với dạng data url
      } else {
        // Nếu không phải ảnh
        previewItem.innerHTML = `
          <div class="preview-file">
            📄 ${file.name}
          </div>
          <div class="preview-remove">×</div>
        `;
      }

      // Xử lý xoá file
      previewItem.addEventListener("click", () => {
        selectedFiles = selectedFiles.filter(f => f !== file); // Xóa file trong danh sách
        previewItem.remove(); // Xóa phần preview
        if(selectedFiles.length === 0) {
          chatPreview.classList.add("d-none");
        }
      });

      chatPreview.appendChild(previewItem); // Chèn item vào giao diện
      chatPreview.classList.remove("d-none");
    });

    chatFile.value = ""; // Xóa file khỏi input
  });
}