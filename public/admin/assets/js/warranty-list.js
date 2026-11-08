(function () {
  const checkAll = document.querySelector("#checkAllWarranty");
  const rowChecks = Array.from(document.querySelectorAll(".warranty-row-checkbox"));
  const bulkBar = document.querySelector("#bulkActionBar");
  const countEl = document.querySelector("#selectedTicketsCount");
  const statusSelect = document.querySelector("#bulkStatusSelect");
  const noteInput = document.querySelector("#bulkResolutionNote");
  const applyBtn = document.querySelector("#btnApplyBulkStatus");

  const syncBulkBar = () => {
    const selected = rowChecks.filter((cb) => cb.checked);
    if (countEl) countEl.textContent = String(selected.length);
    if (bulkBar) {
      bulkBar.style.display = selected.length > 0 ? "flex" : "none";
    }
    if (checkAll && rowChecks.length > 0) {
      checkAll.checked = selected.length === rowChecks.length;
    }
  };

  if (checkAll) {
    checkAll.addEventListener("change", () => {
      rowChecks.forEach((cb) => {
        cb.checked = checkAll.checked;
      });
      syncBulkBar();
    });
  }

  rowChecks.forEach((cb) => {
    cb.addEventListener("change", syncBulkBar);
  });

  if (applyBtn) {
    applyBtn.addEventListener("click", async () => {
      const selectedIds = rowChecks.filter((cb) => cb.checked).map((cb) => cb.value);
      const status = statusSelect ? statusSelect.value : "";
      const resolutionNote = noteInput ? noteInput.value.trim() : "";

      if (selectedIds.length === 0) {
        if (typeof notyf !== "undefined") notyf.error("Vui lòng chọn ít nhất một phiếu bảo hành!");
        return;
      }

      if (!status) {
        if (typeof notyf !== "undefined") notyf.error("Vui lòng chọn trạng thái cần cập nhật!");
        return;
      }

      applyBtn.disabled = true;
      try {
        const res = await fetch(`/${pathAdmin}/warranty/bulk-update-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: selectedIds,
            status,
            resolutionNote
          })
        });
        const data = await res.json();
        if (data.code === "success") {
          if (typeof drawNotify === "function") drawNotify("success", data.message);
          window.location.reload();
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          applyBtn.disabled = false;
        }
      } catch (e) {
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối máy chủ!");
        applyBtn.disabled = false;
      }
    });
  }
})();
