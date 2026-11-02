const chatButton = document.querySelector("#chat-button");
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