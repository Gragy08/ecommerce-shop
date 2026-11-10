(function () {
  let currentLookupMode = "auto";
  let partsList = [];

  const lookupInput = document.querySelector("#identifierLookupInput");
  const checkBtn = document.querySelector("#btnCheckDevice");
  const clearLookupBtn = document.querySelector("#btnClearLookup");
  const modeImeiBtn = document.querySelector("#btnModeImei");
  const modePhoneBtn = document.querySelector("#btnModePhone");
  const quickExternalBtn = document.querySelector("#btnQuickExternalDevice");
  const resultCard = document.querySelector("#deviceCheckResultCard");
  const resultBody = document.querySelector("#deviceCheckResultBody");

  const identifierInput = document.querySelector("#identifierInput");
  const generateTempBtn = document.querySelector("#btnGenerateTempCode");
  const isExternalCheck = document.querySelector("#isExternalDeviceCheck");
  const warrantyTypeSelect = document.querySelector("#warrantyTypeSelect");
  const productNameInput = document.querySelector("#productNameInput");
  const variantNameInput = document.querySelector("#variantNameInput");
  const customerPhoneInput = document.querySelector("#customerPhoneInput");
  const customerFullNameInput = document.querySelector("#customerFullNameInput");
  const customerAddressInput = document.querySelector("#customerAddressInput");
  const issueDescriptionInput = document.querySelector("#issueDescriptionInput");
  const deviceConditionInput = document.querySelector("#deviceConditionInput");
  const accessoriesInput = document.querySelector("#accessoriesIncludedInput");
  const estimatedDateInput = document.querySelector("#estimatedReturnDateInput");

  const partSearchInput = document.querySelector("#partSearchInput");
  const partSearchResults = document.querySelector("#partSearchResults");
  const addExternalPartBtn = document.querySelector("#btnAddExternalPart");
  const partsTableBody = document.querySelector("#partsTableBody");
  const partsSubtotalDisplay = document.querySelector("#partsSubtotalDisplay");
  const repairCostInput = document.querySelector("#repairCostInput");
  const totalAmountDisplay = document.querySelector("#totalAmountDisplay");

  // Đặt mặc định ngày hẹn trả sau 3 ngày
  if (estimatedDateInput && !estimatedDateInput.value) {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    estimatedDateInput.value = d.toISOString().split("T")[0];
  }

  const generateTempMachineCode = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SC-${yy}${mm}${dd}-${rand}`;
  };

  if (modeImeiBtn && modePhoneBtn) {
    modeImeiBtn.addEventListener("click", () => {
      currentLookupMode = "imei";
      modeImeiBtn.className = "btn btn-primary";
      modePhoneBtn.className = "btn btn-outline-primary";
      if (lookupInput) {
        lookupInput.placeholder = "Quét hoặc nhập mã IMEI thiết bị...";
        lookupInput.focus();
      }
    });

    modePhoneBtn.addEventListener("click", () => {
      currentLookupMode = "phone";
      modePhoneBtn.className = "btn btn-primary";
      modeImeiBtn.className = "btn btn-outline-primary";
      if (lookupInput) {
        lookupInput.placeholder = "Nhập Số điện thoại khách hàng để tra lịch sử mua máy...";
        lookupInput.focus();
      }
    });
  }

  if (lookupInput) {
    lookupInput.addEventListener("input", () => {
      if (clearLookupBtn) {
        clearLookupBtn.style.display = lookupInput.value.trim() ? "block" : "none";
      }
    });

    lookupInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeCheckDevice();
      }
    });
  }

  if (clearLookupBtn) {
    clearLookupBtn.addEventListener("click", () => {
      if (lookupInput) {
        lookupInput.value = "";
        lookupInput.focus();
      }
      clearLookupBtn.style.display = "none";
      if (resultCard) resultCard.style.display = "none";
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener("click", () => executeCheckDevice());
  }

  if (generateTempBtn) {
    generateTempBtn.addEventListener("click", () => {
      if (identifierInput) identifierInput.value = generateTempMachineCode();
    });
  }

  if (quickExternalBtn) {
    quickExternalBtn.addEventListener("click", () => {
      if (isExternalCheck) isExternalCheck.checked = true;
      if (warrantyTypeSelect) warrantyTypeSelect.value = "repair";
      if (identifierInput && !identifierInput.value.trim()) {
        identifierInput.value = generateTempMachineCode();
      }
      productNameInput?.focus();
      if (typeof notyf !== "undefined") {
        notyf.success("Đã bật chế độ Tiếp nhận máy ngoài / Sửa chữa dịch vụ!");
      }
    });
  }

  const executeCheckDevice = async () => {
    const query = lookupInput ? lookupInput.value.trim() : "";
    if (!query) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập mã IMEI hoặc Số điện thoại khách hàng!");
      return;
    }

    try {
      const res = await fetch(
        `/${pathAdmin}/warranty/api/check-device?identifier=${encodeURIComponent(query)}&mode=${currentLookupMode}`
      );
      const data = await res.json();

      if (data.code === "error") {
        if (typeof notyf !== "undefined") notyf.error(data.message);
        return;
      }

      if (resultCard) resultCard.style.display = "block";

      if (data.searchMode === "phone") {
        renderPhoneLookupResult(data);
      } else {
        renderImeiLookupResult(data);
      }
    } catch (e) {
      console.error("Check device error:", e);
      if (typeof notyf !== "undefined") notyf.error("Lỗi khi tra cứu thông tin thiết bị!");
    }
  };

  const renderPhoneLookupResult = (data) => {
    if (!resultBody) return;

    if (data.customer) {
      if (customerPhoneInput) customerPhoneInput.value = data.customer.phone || "";
      if (customerFullNameInput) customerFullNameInput.value = data.customer.fullName || "";
      if (customerAddressInput) customerAddressInput.value = data.customer.address || "";
    }

    const devices = data.purchasedDevices || [];
    if (devices.length === 0) {
      resultBody.innerHTML = `
        <div class="alert alert-warning mb-0">
          <strong>${data.message}</strong>
        </div>
      `;
      return;
    }

    const rowsHtml = devices
      .map((dev, idx) => {
        const badge = dev.isQuantityItem
          ? `<span class="badge bg-secondary">Sản phẩm SL (${dev.quantity || 1})</span>`
          : dev.isUnderWarranty
          ? `<span class="badge bg-success">Còn bảo hành (${dev.remainingDays} ngày)</span>`
          : `<span class="badge bg-danger">Hết hạn bảo hành</span>`;

        return `
          <tr>
            <td>
              <strong>${dev.productName}</strong>
              ${dev.variantName ? `<div class="small text-muted">${dev.variantName}</div>` : ""}
            </td>
            <td><code>${dev.identifier || "Không có IMEI"}</code></td>
            <td><span class="badge bg-light text-dark border">${dev.orderCode || "-"}</span></td>
            <td>${badge}</td>
            <td class="text-end">
              <button type="button" class="btn btn-sm btn-primary btn-select-purchased-device" data-idx="${idx}">
                Chọn máy này
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    resultBody.innerHTML = `
      <div class="p-3 bg-light rounded border">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong class="text-primary">
            <i class="fa-solid fa-user-check me-1"></i>${data.message}
          </strong>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-bordered bg-white align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Thiết bị đã mua</th>
                <th>Mã IMEI</th>
                <th>Đơn hàng</th>
                <th>Thời hạn bảo hành</th>
                <th class="text-end">Hành động</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;

    resultBody.querySelectorAll(".btn-select-purchased-device").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        const dev = devices[idx];
        if (!dev) return;

        if (identifierInput) {
          identifierInput.value = dev.identifier || generateTempMachineCode();
        }
        if (productNameInput) productNameInput.value = dev.productName || "";
        if (variantNameInput) variantNameInput.value = dev.variantName || "";
        if (isExternalCheck) isExternalCheck.checked = false;
        if (warrantyTypeSelect) {
          warrantyTypeSelect.value = dev.isUnderWarranty ? "warranty" : "repair";
        }
        issueDescriptionInput?.focus();
        if (typeof notyf !== "undefined") {
          notyf.success(`Đã điền thông tin thiết bị "${dev.productName}" vào phiếu!`);
        }
      });
    });
  };

  const renderImeiLookupResult = (data) => {
    if (!resultBody) return;

    if (!data.found) {
      if (identifierInput) identifierInput.value = data.identifier || "";
      if (isExternalCheck) isExternalCheck.checked = true;
      if (warrantyTypeSelect) warrantyTypeSelect.value = "repair";

      resultBody.innerHTML = `
        <div class="alert alert-warning mb-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <i class="fa-solid fa-triangle-exclamation me-1"></i>
            <strong>${data.message}</strong>
          </div>
          <span class="badge bg-warning text-dark">Đã chuyển sang chế độ Máy ngoài / Sửa dịch vụ</span>
        </div>
      `;
      productNameInput?.focus();
      return;
    }

    if (identifierInput) identifierInput.value = data.device.identifier || "";
    if (productNameInput && data.product) productNameInput.value = data.product.name || "";
    if (variantNameInput && data.variant) variantNameInput.value = data.variant.variantName || "";
    if (isExternalCheck) isExternalCheck.checked = false;

    if (data.soldOrder && data.soldOrder.customerInfo) {
      if (customerFullNameInput) customerFullNameInput.value = data.soldOrder.customerInfo.fullName || "";
      if (customerPhoneInput) customerPhoneInput.value = data.soldOrder.customerInfo.phone || "";
      if (customerAddressInput) customerAddressInput.value = data.soldOrder.customerInfo.address || "";
    }

    const wInfo = data.warrantyInfo || {};
    if (warrantyTypeSelect) {
      warrantyTypeSelect.value = wInfo.isUnderWarranty ? "warranty" : "repair";
    }

    const warrantyBadge = wInfo.isUnderWarranty
      ? `<span class="badge bg-success">Còn hạn bảo hành (${wInfo.remainingDays} ngày)</span>`
      : `<span class="badge bg-danger">Đã hết hạn bảo hành</span>`;

    resultBody.innerHTML = `
      <div class="p-3 bg-success-subtle bg-opacity-25 rounded border border-success">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div>
            <strong class="text-success">
              <i class="fa-solid fa-circle-check me-1"></i>Đã tìm thấy thiết bị chính hãng của cửa hàng!
            </strong>
          </div>
          <div>${warrantyBadge}</div>
        </div>
        <div class="row g-2 small">
          <div class="col-md-4">
            <span class="text-muted">Thiết bị:</span>
            <strong class="ms-1">${data.product ? data.product.name : "-"} ${
      data.variant && data.variant.variantName ? `(${data.variant.variantName})` : ""
    }</strong>
          </div>
          <div class="col-md-4">
            <span class="text-muted">Mã đơn mua:</span>
            <strong class="ms-1">${data.soldOrder ? data.soldOrder.orderCode : "Chưa có hóa đơn xuất"}</strong>
          </div>
          <div class="col-md-4">
            <span class="text-muted">Khách hàng:</span>
            <strong class="ms-1">${
              data.soldOrder && data.soldOrder.customerInfo ? data.soldOrder.customerInfo.fullName : "-"
            }</strong>
          </div>
        </div>
      </div>
    `;

    issueDescriptionInput?.focus();
  };

  // Tìm kiếm linh kiện trong kho
  let partTimer = null;
  if (partSearchInput) {
    partSearchInput.addEventListener("input", () => {
      clearTimeout(partTimer);
      const q = partSearchInput.value.trim();
      if (!q) {
        if (partSearchResults) partSearchResults.style.display = "none";
        return;
      }
      partTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/${pathAdmin}/warranty/api/search-parts?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (data.code === "success") {
            renderPartSearchResults(data.parts || []);
          }
        } catch (e) {}
      }, 220);
    });
  }

  document.addEventListener("click", (e) => {
    if (partSearchResults && !partSearchResults.contains(e.target) && e.target !== partSearchInput) {
      partSearchResults.style.display = "none";
    }
  });

  const renderPartSearchResults = (parts) => {
    if (!partSearchResults) return;
    if (!parts || parts.length === 0) {
      partSearchResults.innerHTML = `<div class="p-2 text-muted small text-center">Không tìm thấy linh kiện phù hợp trong kho.</div>`;
      partSearchResults.style.display = "block";
      return;
    }

    partSearchResults.innerHTML = parts
      .map(
        (p) => `
        <div class="dropdown-item p-2 border-bottom part-search-item" style="cursor: pointer;"
          data-part='${JSON.stringify(p).replace(/'/g, "&#39;")}'>
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong class="text-dark">${p.partName}</strong>
              <div class="small text-muted">SKU: <code>${p.sku || "-"}</code> | Tồn: ${p.availableQty}</div>
            </div>
            <strong class="text-danger">${Number(p.unitPrice || 0).toLocaleString("vi-VN")} đ</strong>
          </div>
        </div>
      `
      )
      .join("");

    partSearchResults.style.display = "block";

    partSearchResults.querySelectorAll(".part-search-item").forEach((el) => {
      el.addEventListener("click", () => {
        const partData = JSON.parse(el.getAttribute("data-part").replace(/&#39;/g, "'"));
        const existing = partsList.find(
          (item) => item.variantId && String(item.variantId) === String(partData.variantId)
        );
        if (existing) {
          existing.quantity += 1;
        } else {
          partsList.push({
            inventoryItemId: partData.inventoryItemId || null,
            productId: partData.productId || null,
            variantId: partData.variantId || null,
            partName: partData.partName,
            sku: partData.sku || "",
            quantity: 1,
            unitCost: Number(partData.unitCost || 0),
            unitPrice: Number(partData.unitPrice || 0),
            isExternal: false
          });
        }
        renderPartsTable();
        partSearchResults.style.display = "none";
        if (partSearchInput) partSearchInput.value = "";
      });
    });
  };

  if (addExternalPartBtn) {
    addExternalPartBtn.addEventListener("click", () => {
      partsList.push({
        inventoryItemId: null,
        productId: null,
        variantId: null,
        partName: "Linh kiện thay thế ngoài",
        sku: "LK-NGOAI",
        quantity: 1,
        unitCost: 0,
        unitPrice: 0,
        isExternal: true
      });
      renderPartsTable();
    });
  }

  const renderPartsTable = () => {
    if (!partsTableBody) return;

    if (partsList.length === 0) {
      partsTableBody.innerHTML = `
        <tr id="partsEmptyRow">
          <td class="text-center text-muted py-3" colspan="6">Chưa chọn linh kiện thay thế nào.</td>
        </tr>
      `;
      updateCostSummary();
      return;
    }

    partsTableBody.innerHTML = partsList
      .map((p, idx) => {
        const lineTotal = Number(p.quantity || 1) * Number(p.unitPrice || 0);
        return `
          <tr>
            <td>
              <input type="text" class="form-control form-control-sm part-name-input" data-idx="${idx}" value="${p.partName}">
            </td>
            <td><code>${p.sku || "-"}</code></td>
            <td>
              <input type="number" class="form-control form-control-sm text-center part-qty-input" data-idx="${idx}" min="1" value="${p.quantity}">
            </td>
            <td>
              <input type="number" class="form-control form-control-sm text-end part-price-input" data-idx="${idx}" min="0" step="1000" value="${p.unitPrice}">
            </td>
            <td class="text-end fw-semibold">${lineTotal.toLocaleString("vi-VN")} đ</td>
            <td class="text-center">
              <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-remove-part" data-idx="${idx}">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    partsTableBody.querySelectorAll(".part-name-input").forEach((el) => {
      el.addEventListener("input", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        if (partsList[idx]) partsList[idx].partName = e.target.value;
      });
    });

    partsTableBody.querySelectorAll(".part-qty-input").forEach((el) => {
      el.addEventListener("change", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        if (partsList[idx]) {
          partsList[idx].quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
          renderPartsTable();
        }
      });
    });

    partsTableBody.querySelectorAll(".part-price-input").forEach((el) => {
      el.addEventListener("change", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        if (partsList[idx]) {
          partsList[idx].unitPrice = Math.max(0, parseFloat(e.target.value) || 0);
          renderPartsTable();
        }
      });
    });

    partsTableBody.querySelectorAll(".btn-remove-part").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        partsList.splice(idx, 1);
        renderPartsTable();
      });
    });

    updateCostSummary();
  };

  const updateCostSummary = () => {
    const partsTotal = partsList.reduce(
      (sum, p) => sum + Number(p.quantity || 1) * Number(p.unitPrice || 0),
      0
    );
    const repairCost = Math.max(0, parseFloat(repairCostInput ? repairCostInput.value : "0") || 0);
    const total = partsTotal + repairCost;

    if (partsSubtotalDisplay) partsSubtotalDisplay.textContent = `${partsTotal.toLocaleString("vi-VN")} đ`;
    if (totalAmountDisplay) totalAmountDisplay.textContent = `${total.toLocaleString("vi-VN")} đ`;
  };

  if (repairCostInput) {
    repairCostInput.addEventListener("input", updateCostSummary);
  }

  // Submit form tạo phiếu bảo hành
  const createForm = document.querySelector("#warrantyCreateForm");
  if (createForm) {
    createForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.querySelector("#btnSubmitWarranty");
      const payload = {
        identifier: identifierInput ? identifierInput.value.trim() : "",
        isExternalDevice: isExternalCheck ? isExternalCheck.checked : false,
        warrantyType: warrantyTypeSelect ? warrantyTypeSelect.value : "warranty",
        productName: productNameInput ? productNameInput.value.trim() : "",
        variantName: variantNameInput ? variantNameInput.value.trim() : "",
        customerPhone: customerPhoneInput ? customerPhoneInput.value.trim() : "",
        customerFullName: customerFullNameInput ? customerFullNameInput.value.trim() : "",
        customerAddress: customerAddressInput ? customerAddressInput.value.trim() : "",
        issueDescription: issueDescriptionInput ? issueDescriptionInput.value.trim() : "",
        deviceCondition: deviceConditionInput ? deviceConditionInput.value.trim() : "",
        accessoriesIncluded: accessoriesInput ? accessoriesInput.value.trim() : "",
        estimatedReturnDate: estimatedDateInput ? estimatedDateInput.value : "",
        repairCost: repairCostInput ? parseFloat(repairCostInput.value) || 0 : 0,
        partsUsed: partsList
      };

      if (!payload.productName) {
        if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập tên dòng máy / sản phẩm!");
        productNameInput?.focus();
        return;
      }

      if (!payload.customerFullName || !payload.customerPhone) {
        if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập đầy đủ Họ tên và Số điện thoại khách hàng!");
        customerPhoneInput?.focus();
        return;
      }

      if (!payload.issueDescription) {
        if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập mô tả lỗi của thiết bị!");
        issueDescriptionInput?.focus();
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(`/${pathAdmin}/warranty/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.code === "success") {
          if (typeof drawNotify === "function") drawNotify("success", data.message);
          window.location.href = `/${pathAdmin}/warranty/detail/${data.ticketId}`;
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          if (submitBtn) submitBtn.disabled = false;
        }
      } catch (err) {
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối máy chủ!");
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();
