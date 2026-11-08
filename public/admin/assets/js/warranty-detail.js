window.printWarrantyTicket = function (targetMode) {
  document.body.setAttribute("data-print-target", targetMode);
  window.print();
};

(function () {
  // 1. Cập nhật tiến độ xử lý
  const updateStatusForm = document.querySelector("#updateStatusForm");
  if (updateStatusForm) {
    updateStatusForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ticketId = updateStatusForm.getAttribute("data-ticket-id");
      const status = document.querySelector("#statusSelect")?.value || "received";
      const repairCost = parseFloat(document.querySelector("#quickRepairCost")?.value || "0") || 0;
      const resolutionNote = (document.querySelector("#resolutionNoteInput")?.value || "").trim();
      const btn = document.querySelector("#btnSaveStatus");

      if (btn) btn.disabled = true;
      try {
        const res = await fetch(`/${pathAdmin}/warranty/update-status/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, repairCost, resolutionNote })
        });
        const data = await res.json();
        if (data.code === "success") {
          if (typeof drawNotify === "function") drawNotify("success", data.message);
          window.location.reload();
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          if (btn) btn.disabled = false;
        }
      } catch (err) {
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối máy chủ!");
        if (btn) btn.disabled = false;
      }
    });
  }

  // 2. Xác nhận Bàn giao & Trả máy khách
  const btnConfirmDeliver = document.querySelector("#btnConfirmDeliver");
  if (btnConfirmDeliver) {
    btnConfirmDeliver.addEventListener("click", async () => {
      const ticketId = btnConfirmDeliver.getAttribute("data-ticket-id");
      const resolutionNote = (document.querySelector("#deliverResolutionNote")?.value || "").trim();
      const repairCost = parseFloat(document.querySelector("#deliverRepairCost")?.value || "0") || 0;
      const paymentMethod = document.querySelector("#deliverPaymentMethod")?.value || "Miễn phí (Bảo hành)";

      btnConfirmDeliver.disabled = true;
      try {
        const res = await fetch(`/${pathAdmin}/warranty/deliver/${ticketId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolutionNote, repairCost, paymentMethod })
        });
        const data = await res.json();
        if (data.code === "success") {
          if (typeof drawNotify === "function") drawNotify("success", data.message);
          window.location.reload();
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          btnConfirmDeliver.disabled = false;
        }
      } catch (err) {
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối máy chủ!");
        btnConfirmDeliver.disabled = false;
      }
    });
  }

  // 3. Tìm kiếm IMEI đổi mới 1-1 & Xác nhận Đổi 1-1
  const searchExchangeInput = document.querySelector("#searchExchangeImeiInput");
  const btnSearchExchange = document.querySelector("#btnSearchExchangeImei");
  const replacementSelect = document.querySelector("#replacementItemSelect");

  const executeSearchExchangeImei = async () => {
    if (!searchExchangeInput || !replacementSelect) return;
    const q = searchExchangeInput.value.trim();
    const variantId = searchExchangeInput.getAttribute("data-variant-id") || "";
    const productId = searchExchangeInput.getAttribute("data-product-id") || "";

    try {
      const params = new URLSearchParams();
      if (q) {
        params.set("q", q);
      } else {
        if (variantId) params.set("variantId", variantId);
        if (productId) params.set("productId", productId);
      }

      const res = await fetch(`/${pathAdmin}/warranty/api/search-available-imei?${params.toString()}`);
      const data = await res.json();
      if (data.code === "success") {
        const items = data.items || [];
        if (items.length === 0) {
          replacementSelect.innerHTML = `<option value="" disabled>Không tìm thấy thiết bị IMEI khả dụng phù hợp.</option>`;
          return;
        }
        replacementSelect.innerHTML = items
          .map(
            (it) =>
              `<option value="${it._id}">IMEI: ${it.identifier} — ${it.productName} ${
                it.variantName ? `(${it.variantName})` : ""
              }</option>`
          )
          .join("");
        replacementSelect.selectedIndex = 0;
      }
    } catch (e) {}
  };

  if (btnSearchExchange) {
    btnSearchExchange.addEventListener("click", executeSearchExchangeImei);
  }
  if (searchExchangeInput) {
    searchExchangeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeSearchExchangeImei();
      }
    });
  }

  const btnConfirmExchange = document.querySelector("#btnConfirmExchange1to1");
  if (btnConfirmExchange) {
    btnConfirmExchange.addEventListener("click", async () => {
      const ticketId = btnConfirmExchange.getAttribute("data-ticket-id");
      const replacementItemId = replacementSelect ? replacementSelect.value : "";
      const resolutionNote = (document.querySelector("#exchangeResolutionNote")?.value || "").trim();

      if (!replacementItemId) {
        if (typeof notyf !== "undefined") {
          notyf.error("Vui lòng chọn một thiết bị IMEI mới trong danh sách để đổi cho khách!");
        }
        return;
      }

      btnConfirmExchange.disabled = true;
      try {
        const res = await fetch(`/${pathAdmin}/warranty/exchange-1to1/${ticketId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replacementItemId, resolutionNote })
        });
        const data = await res.json();
        if (data.code === "success") {
          if (typeof drawNotify === "function") drawNotify("success", data.message);
          window.location.reload();
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          btnConfirmExchange.disabled = false;
        }
      } catch (err) {
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối máy chủ!");
        btnConfirmExchange.disabled = false;
      }
    });
  }

  // 4. Lưu chỉnh sửa thông tin phiếu
  const btnSaveEditTicket = document.querySelector("#btnSaveEditTicket");
  if (btnSaveEditTicket) {
    btnSaveEditTicket.addEventListener("click", async () => {
      const ticketId = btnSaveEditTicket.getAttribute("data-ticket-id");
      const payload = {
        customerFullName: document.querySelector("#editCustomerFullName")?.value || "",
        customerPhone: document.querySelector("#editCustomerPhone")?.value || "",
        customerAddress: document.querySelector("#editCustomerAddress")?.value || "",
        productName: document.querySelector("#editProductName")?.value || "",
        variantName: document.querySelector("#editVariantName")?.value || "",
        warrantyType: document.querySelector("#editWarrantyType")?.value || "warranty",
        deviceCondition: document.querySelector("#editDeviceCondition")?.value || "",
        accessoriesIncluded: document.querySelector("#editAccessoriesIncluded")?.value || "",
        issueDescription: document.querySelector("#editIssueDescription")?.value || "",
        estimatedReturnDate: document.querySelector("#editEstimatedReturnDate")?.value || "",
        repairCost: parseFloat(document.querySelector("#editRepairCost")?.value || "0") || 0
      };

      btnSaveEditTicket.disabled = true;
      try {
        const res = await fetch(`/${pathAdmin}/warranty/edit/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.code === "success") {
          if (typeof drawNotify === "function") drawNotify("success", data.message);
          window.location.reload();
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          btnSaveEditTicket.disabled = false;
        }
      } catch (err) {
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối máy chủ!");
        btnSaveEditTicket.disabled = false;
      }
    });
  }
})();
