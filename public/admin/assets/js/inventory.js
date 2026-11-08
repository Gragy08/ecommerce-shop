// Script quản lý kho hàng, nhập kho & IMEI
document.addEventListener("DOMContentLoaded", () => {
  const pathAdmin = "admin"; // Path prefix mặc định

  // ==========================================
  // 1. TẠO PHIẾU NHẬP KHO (#receiptCreateForm)
  // ==========================================
  const receiptForm = document.querySelector("#receiptCreateForm");
  const tableReceiptLines = document.querySelector("#tableReceiptLines tbody");
  const btnAddReceiptLine = document.querySelector("#btnAddReceiptLine");
  const hasInvoice = document.querySelector("#hasInvoice");
  const invoiceNumberGroup = document.querySelector("#invoiceNumberGroup");
  const invoiceNumber = document.querySelector("#invoiceNumber");
  const totalReceiptCostText = document.querySelector("#totalReceiptCostText");

  const variantList = window.variantList || [];

  // Toggle hóa đơn
  if (hasInvoice && invoiceNumberGroup) {
    hasInvoice.addEventListener("change", (e) => {
      const checked = e.target.checked;
      invoiceNumberGroup.style.display = checked ? "block" : "none";
      if (invoiceNumber) {
        invoiceNumber.required = checked;
        if (!checked) invoiceNumber.value = "";
      }
    });
  }

  // Floating dropdown menu gợi ý biến thể
  let suggestMenu = document.querySelector("#globalVariantSuggestMenu");
  if (!suggestMenu) {
    suggestMenu = document.createElement("div");
    suggestMenu.id = "globalVariantSuggestMenu";
    suggestMenu.className = "dropdown-menu shadow p-0";
    suggestMenu.style.position = "absolute";
    suggestMenu.style.display = "none";
    suggestMenu.style.zIndex = "1060";
    suggestMenu.style.maxHeight = "280px";
    suggestMenu.style.overflowY = "auto";
    document.body.appendChild(suggestMenu);
  }

  let activeLine = null;
  let activeInput = null;

  const positionSuggestMenu = (input) => {
    if (!input || !suggestMenu) return;
    const rect = input.getBoundingClientRect();
    suggestMenu.style.top = `${rect.bottom + window.scrollY}px`;
    suggestMenu.style.left = `${rect.left + window.scrollX}px`;
    suggestMenu.style.width = `${Math.max(rect.width, 360)}px`;
  };

  const renderSuggestions = (items) => {
    if (!items.length) {
      suggestMenu.innerHTML = `<div class="p-3 text-center text-muted small">Không tìm thấy sản phẩm nào phù hợp</div>`;
      return;
    }

    suggestMenu.innerHTML = items
      .map((item) => {
        const typeBadge =
          item.trackingType === "imei"
            ? '<span class="badge bg-primary">IMEI</span>'
            : '<span class="badge bg-secondary">Số lượng</span>';

        return `
          <button type="button" class="list-group-item list-group-item-action py-2 px-3 suggest-variant-item" data-id="${item.id}">
            <div class="d-flex justify-content-between align-items-center">
              <strong class="text-primary text-truncate">${item.productName}</strong>
              ${typeBadge}
            </div>
            <div class="d-flex justify-content-between align-items-center small text-muted mt-1">
              <span>${item.labels || "Mặc định"}</span>
              <code>${item.sku}</code>
            </div>
          </button>
        `;
      })
      .join("");
  };

  const normalizeText = (str) => {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .toLowerCase()
      .trim();
  };

  const filterVariants = (keyword) => {
    const kRaw = (keyword || "").normalize("NFC").toLowerCase().trim();
    const kNorm = normalizeText(keyword);
    if (!kRaw) return variantList.slice(0, 50);
    return variantList
      .filter((v) => {
        const nameLower = (v.productName || "").normalize("NFC").toLowerCase();
        const skuLower = (v.sku || "").toLowerCase();
        const labelsLower = (v.labels || "").normalize("NFC").toLowerCase();
        const titleLower = (v.fullTitle || "").normalize("NFC").toLowerCase();

        if (
          nameLower.includes(kRaw) ||
          skuLower.includes(kRaw) ||
          labelsLower.includes(kRaw) ||
          titleLower.includes(kRaw)
        ) {
          return true;
        }

        return (
          normalizeText(v.productName).includes(kNorm) ||
          normalizeText(v.sku).includes(kNorm) ||
          normalizeText(v.labels).includes(kNorm) ||
          normalizeText(v.fullTitle).includes(kNorm)
        );
      })
      .slice(0, 50);
  };

  const hideSuggestions = () => {
    if (suggestMenu) suggestMenu.style.display = "none";
  };

  suggestMenu.addEventListener("click", (e) => {
    const btn = e.target.closest(".suggest-variant-item");
    if (!btn || !activeLine) return;
    const vId = btn.dataset.id;
    const variant = variantList.find((v) => v.id === vId);
    if (variant) {
      selectVariantForLine(activeLine, variant);
    }
    hideSuggestions();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#globalVariantSuggestMenu") && !e.target.closest(".variant-search-wrap")) {
      hideSuggestions();
    }
  });

  const selectVariantForLine = (line, variant) => {
    const searchInput = line.querySelector(".variant-search-input");
    const idInput = line.querySelector(".variant-id-input");
    const identifiers = line.querySelector(".variant-identifiers");
    const quantity = line.querySelector(".variant-quantity");
    const price = line.querySelector(".variant-price");

    searchInput.value = variant.fullTitle;
    idInput.value = variant.id;
    line.dataset.trackingType = variant.trackingType;

    const isImei = variant.trackingType === "imei";
    identifiers.disabled = !isImei;
    quantity.disabled = isImei;

    if (isImei) {
      quantity.value = 0;
      identifiers.focus();
    } else {
      identifiers.value = "";
      quantity.value = 1;
    }

    if (variant.defaultPrice) {
      price.value = variant.defaultPrice;
    }

    calcLineTotal(line);
    calcReceiptTotal();
  };

  const calcLineTotal = (line) => {
    const isImei = line.dataset.trackingType === "imei";
    const identifiers = line.querySelector(".variant-identifiers");
    const quantity = line.querySelector(".variant-quantity");
    const price = line.querySelector(".variant-price");
    const total = line.querySelector(".variant-total");

    let qty = 0;
    if (isImei) {
      const imeiList = identifiers.value
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      qty = imeiList.length;
      quantity.value = qty;
    } else {
      qty = Number(quantity.value) || 0;
    }

    const unitPrice = Number(price.value) || 0;
    const lineTotal = qty * unitPrice;

    if (total) {
      total.value = lineTotal.toLocaleString("vi-VN") + " đ";
    }

    return lineTotal;
  };

  const calcReceiptTotal = () => {
    if (!totalReceiptCostText || !tableReceiptLines) return;
    const lines = tableReceiptLines.querySelectorAll(".receipt-line");
    let sum = 0;
    lines.forEach((line) => {
      sum += calcLineTotal(line);
    });
    totalReceiptCostText.textContent = sum.toLocaleString("vi-VN") + " đ";
  };

  const bindLineEvents = (line) => {
    const searchInput = line.querySelector(".variant-search-input");
    const idInput = line.querySelector(".variant-id-input");
    const identifiers = line.querySelector(".variant-identifiers");
    const quantity = line.querySelector(".variant-quantity");
    const price = line.querySelector(".variant-price");
    const removeBtn = line.querySelector(".btn-remove-line");

    searchInput?.addEventListener("focus", () => {
      activeLine = line;
      activeInput = searchInput;
      renderSuggestions(filterVariants(searchInput.value));
      suggestMenu.style.display = "block";
      positionSuggestMenu(searchInput);
    });

    searchInput?.addEventListener("input", () => {
      idInput.value = "";
      activeLine = line;
      activeInput = searchInput;
      renderSuggestions(filterVariants(searchInput.value));
      suggestMenu.style.display = "block";
      positionSuggestMenu(searchInput);
    });

    identifiers?.addEventListener("input", () => {
      calcLineTotal(line);
      calcReceiptTotal();
    });

    quantity?.addEventListener("input", () => {
      calcLineTotal(line);
      calcReceiptTotal();
    });

    price?.addEventListener("input", () => {
      calcLineTotal(line);
      calcReceiptTotal();
    });

    removeBtn?.addEventListener("click", () => {
      const rows = tableReceiptLines.querySelectorAll(".receipt-line");
      if (rows.length > 1) {
        line.remove();
        calcReceiptTotal();
      }
    });
  };

  // Bind dòng đầu tiên
  if (tableReceiptLines) {
    tableReceiptLines.querySelectorAll(".receipt-line").forEach(bindLineEvents);
  }

  // Thêm dòng mới
  btnAddReceiptLine?.addEventListener("click", () => {
    if (!tableReceiptLines) return;
    const newRow = document.createElement("tr");
    newRow.className = "receipt-line";
    newRow.innerHTML = `
      <td>
        <div class="variant-search-wrap position-relative">
          <input class="form-control variant-search-input" type="text" autocomplete="off">
          <input class="variant-id-input" type="hidden" name="variantId">
        </div>
      </td>
      <td><textarea class="form-control variant-identifiers" rows="2" disabled></textarea></td>
      <td><input class="form-control variant-quantity" type="number" min="1" value="1" disabled></td>
      <td><input class="form-control variant-price" type="number" min="0" value="0"></td>
      <td><input class="form-control variant-total" type="text" readonly value="0 đ"></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-danger btn-remove-line" type="button"><i class="fa-solid fa-times"></i></button>
      </td>
    `;
    tableReceiptLines.appendChild(newRow);
    bindLineEvents(newRow);
  });

  // Submit tạo phiếu nhập kho
  receiptForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const lines = [];
    const rows = tableReceiptLines.querySelectorAll(".receipt-line");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const variantId = row.querySelector(".variant-id-input").value;
      if (!variantId) {
        if (typeof notyf !== "undefined") notyf.error(`Dòng ${i + 1} chưa chọn biến thể sản phẩm!`);
        return;
      }

      const isImei = row.dataset.trackingType === "imei";
      const quantity = Number(row.querySelector(".variant-quantity").value) || 0;
      const purchasePrice = Number(row.querySelector(".variant-price").value) || 0;
      const identifiers = row.querySelector(".variant-identifiers").value;

      if (isImei && (!identifiers || quantity === 0)) {
        if (typeof notyf !== "undefined") notyf.error(`Dòng ${i + 1} yêu cầu nhập ít nhất 1 mã IMEI!`);
        return;
      }

      lines.push({
        variantId,
        quantity,
        purchasePrice,
        identifiers: isImei ? identifiers : undefined
      });
    }

    const formData = new FormData(receiptForm);
    const body = {
      supplierId: formData.get("supplierId"),
      supplierContactName: formData.get("supplierContactName"),
      hasInvoice: hasInvoice ? hasInvoice.checked : false,
      invoiceNumber: formData.get("invoiceNumber"),
      note: formData.get("note"),
      lines
    };

    try {
      const response = await fetch("/admin/inventory/receipt/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (data.code === "success") {
        if (typeof drawNotify !== "undefined") {
          drawNotify("success", data.message);
        }
        window.location.href = "/admin/inventory/receipt";
      } else {
        if (typeof notyf !== "undefined") {
          notyf.error(data.message || "Lỗi tạo phiếu nhập kho!");
        } else {
          alert(data.message);
        }
      }
    } catch (err) {
      if (typeof notyf !== "undefined") notyf.error("Lỗi gửi dữ liệu tới máy chủ!");
    }
  });

  // ==========================================
  // 2. MODAL XEM & ĐỔI TRẠNG THÁI IMEI (TỒN KHO)
  // ==========================================
  const modalImeiEl = document.querySelector("#modalImei");
  const modalVariantName = document.querySelector("#modalVariantName");
  const modalImeiBody = document.querySelector("#modalImeiBody");
  let imeiModalInstance = null;

  const loadImeiModalData = async (variantId) => {
    if (!modalImeiBody) return;
    modalImeiBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Đang tải danh sách IMEI...</td></tr>`;

    try {
      const res = await fetch(`/admin/inventory/items/${variantId}`);
      const data = await res.json();

      if (data.code === "success" && data.items && data.items.length > 0) {
        modalImeiBody.innerHTML = data.items
          .map((item, idx) => {
            const isSold = item.status === "sold";
            const statusControl = isSold
              ? `<span class="badge bg-dark">Đã bán</span>`
              : `
                <select class="form-select form-select-sm select-change-status" data-id="${item.id}">
                  <option value="available" ${item.status === "available" ? "selected" : ""}>Có sẵn</option>
                  <option value="warranty" ${item.status === "warranty" ? "selected" : ""}>Bảo hành</option>
                  <option value="damaged" ${item.status === "damaged" ? "selected" : ""}>Hỏng / Lỗi</option>
                  <option value="liquidated" ${item.status === "liquidated" ? "selected" : ""}>Đã thanh lý</option>
                </select>
              `;

            return `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td>
                  <a href="/admin/inventory/tracker?keyword=${item.identifier}" target="_blank" class="font-monospace fw-bold text-primary">
                    ${item.identifier}
                  </a>
                </td>
                <td><span class="badge bg-light text-dark border">${item.receiptCode}</span></td>
                <td>${item.supplierName}</td>
                <td>${statusControl}</td>
              </tr>
            `;
          })
          .join("");

        // Gán sự kiện đổi trạng thái qua select
        modalImeiBody.querySelectorAll(".select-change-status").forEach((selectEl) => {
          selectEl.addEventListener("change", async (e) => {
            const itemId = selectEl.getAttribute("data-id");
            const toStatus = e.target.value;

            try {
              const patchRes = await fetch(`/admin/inventory/item/change-status/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toStatus, reason: "Điều chỉnh từ quản trị viên" })
              });
              const patchData = await patchRes.json();

              if (patchData.code === "success") {
                if (typeof notyf !== "undefined") notyf.success(patchData.message);
              } else {
                if (typeof notyf !== "undefined") notyf.error(patchData.message);
                loadImeiModalData(variantId);
              }
            } catch (err) {
              if (typeof notyf !== "undefined") notyf.error("Lỗi đổi trạng thái!");
              loadImeiModalData(variantId);
            }
          });
        });
      } else {
        modalImeiBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Không có mã IMEI nào trong kho.</td></tr>`;
      }
    } catch (err) {
      modalImeiBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Lỗi tải dữ liệu IMEI!</td></tr>`;
    }
  };

  document.querySelectorAll(".btn-view-imei").forEach((btn) => {
    btn.addEventListener("click", () => {
      const variantId = btn.getAttribute("data-variant-id");
      const variantName = btn.getAttribute("data-variant-name");

      if (modalVariantName) modalVariantName.textContent = variantName || "";
      if (!imeiModalInstance && modalImeiEl) {
        imeiModalInstance = new bootstrap.Modal(modalImeiEl);
      }
      if (imeiModalInstance) imeiModalInstance.show();

      loadImeiModalData(variantId);
    });
  });
});
