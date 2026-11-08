(function () {
  let cart = [];
  let activeItemIndexForImei = null;
  let tempSelectedImeis = [];

  const getModal = (selector) => {
    const el = document.querySelector(selector);
    return el && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(el) : null;
  };

  const searchInput = document.querySelector("#posSearchInput");
  const searchResults = document.querySelector("#posSearchResults");
  const clearSearchBtn = document.querySelector("#btnClearSearch");
  let searchDebounceTimer = null;

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const keyword = e.target.value.trim();
      if (clearSearchBtn) clearSearchBtn.style.display = keyword ? "block" : "none";

      clearTimeout(searchDebounceTimer);
      if (!keyword) {
        if (searchResults) searchResults.style.display = "none";
        return;
      }

      searchDebounceTimer = setTimeout(() => {
        executeProductSearch(keyword);
      }, 220);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(searchDebounceTimer);
        const keyword = searchInput.value.trim();
        if (keyword) executeProductSearch(keyword);
      }
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      clearSearchBtn.style.display = "none";
      if (searchResults) searchResults.style.display = "none";
    });
  }

  document.addEventListener("click", (e) => {
    if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.style.display = "none";
    }
  });

  const executeProductSearch = async (keyword) => {
    try {
      const response = await fetch(`/${pathAdmin}/order/api/search-products?q=${encodeURIComponent(keyword)}`);
      const data = await response.json();

      if (!response.ok) return;

      if (data.isDirectImeiMatch) {
        if (searchResults) searchResults.style.display = "none";
        if (searchInput) searchInput.value = "";
        if (clearSearchBtn) clearSearchBtn.style.display = "none";
        addDirectImeiToCart(data);
        return;
      }

      if (data.code === "warning") {
        if (typeof notyf !== "undefined") notyf.error(data.message);
        if (searchResults) searchResults.style.display = "none";
        return;
      }

      renderSearchResults(data.results || []);
    } catch (err) {
      console.error("POS search error:", err);
    }
  };

  const renderSearchResults = (items) => {
    if (!searchResults) return;

    if (!items || !items.length) {
      searchResults.innerHTML = `<div class="p-3 text-center text-muted">Không tìm thấy sản phẩm phù hợp.</div>`;
      searchResults.style.display = "block";
      return;
    }

    searchResults.innerHTML = items
      .map((item) => {
        const isOutOfStock = item.availableStock <= 0;
        const attrText = (item.attributeValues || []).map((a) => a.label).filter(Boolean).join(" / ");
        const typeBadge =
          item.inventoryType === "imei"
            ? '<span class="badge bg-primary ms-1">IMEI</span>'
            : '<span class="badge bg-secondary ms-1">Số lượng</span>';

        return `
          <div class="dropdown-item p-2 border-bottom product-search-item ${isOutOfStock ? "opacity-50 text-muted" : ""}"
            style="cursor: ${isOutOfStock ? "not-allowed" : "pointer"};"
            data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong class="text-dark">${item.productName}</strong> ${typeBadge}
                <div class="small text-muted">
                  ${attrText ? `<span>${attrText}</span> | ` : ""}
                  SKU: <code>${item.variantSku || "-"}</code>
                </div>
              </div>
              <div class="text-end">
                <strong class="text-danger d-block">${Number(item.unitPrice || 0).toLocaleString("vi-VN")} đ</strong>
                <small class="${isOutOfStock ? "text-danger fw-bold" : "text-success"}">
                  ${isOutOfStock ? "Hết hàng" : `Tồn: ${item.availableStock}`}
                </small>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    searchResults.style.display = "block";

    searchResults.querySelectorAll(".product-search-item").forEach((el) => {
      el.addEventListener("click", () => {
        const itemData = JSON.parse(el.getAttribute("data-item").replace(/&#39;/g, "'"));
        if (itemData.availableStock <= 0) {
          if (typeof notyf !== "undefined") notyf.error(`Sản phẩm "${itemData.productName}" đã hết hàng trong kho!`);
          return;
        }
        addVariantToCart(itemData);
        searchResults.style.display = "none";
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        if (clearSearchBtn) clearSearchBtn.style.display = "none";
      });
    });
  };

  const addDirectImeiToCart = (data) => {
    const existing = cart.find((i) => !i.isCustomItem && String(i.variantId) === String(data.variant._id));

    if (existing) {
      if (existing.identifiers.includes(data.matchedImei)) {
        if (typeof notyf !== "undefined") notyf.error(`Mã IMEI "${data.matchedImei}" đã có trong giỏ hàng!`);
        return;
      }
      if (data.availableStock != null) existing.availableStock = data.availableStock;
      if (Array.isArray(data.availableIdentifiers)) existing.availableIdentifiers = data.availableIdentifiers;

      existing.identifiers.push(data.matchedImei);
      existing.quantity = existing.identifiers.length;
      existing.totalPrice = existing.quantity * existing.unitPrice;
    } else {
      const attrText = (data.variant.attributeValues || []).map((a) => a.label).filter(Boolean).join(" / ");
      cart.push({
        productId: data.product._id,
        variantId: data.variant._id,
        productName: data.product.name,
        variantSku: data.variant.sku || "",
        variantName: attrText,
        trackingType: "imei",
        unitPrice: Number(data.unitPrice) || 0,
        quantity: 1,
        discount: 0,
        totalPrice: Number(data.unitPrice) || 0,
        identifiers: [data.matchedImei],
        availableStock: data.availableStock || 1,
        availableIdentifiers: data.availableIdentifiers || [data.matchedImei]
      });
    }

    if (typeof notyf !== "undefined") notyf.success(`Đã thêm IMEI ${data.matchedImei} vào giỏ!`);
    renderCart();
  };

  const addVariantToCart = (itemData) => {
    const existingIndex = cart.findIndex((i) => !i.isCustomItem && String(i.variantId) === String(itemData.variantId));
    const attrText = (itemData.attributeValues || []).map((a) => a.label).filter(Boolean).join(" / ");

    if (existingIndex !== -1) {
      const existing = cart[existingIndex];
      if (existing.quantity + 1 > itemData.availableStock) {
        if (typeof notyf !== "undefined") notyf.error(`Chỉ còn tối đa ${itemData.availableStock} sản phẩm trong kho!`);
        return;
      }
      existing.quantity += 1;
      existing.totalPrice = existing.quantity * existing.unitPrice;
      renderCart();

      if (existing.trackingType === "imei") {
        openImeiSelectorModal(existingIndex);
      }
    } else {
      const newIndex = cart.length;
      cart.push({
        productId: itemData.productId,
        variantId: itemData.variantId,
        productName: itemData.productName,
        variantSku: itemData.variantSku || "",
        variantName: attrText,
        trackingType: itemData.inventoryType,
        unitPrice: Number(itemData.unitPrice) || 0,
        quantity: 1,
        discount: 0,
        totalPrice: Number(itemData.unitPrice) || 0,
        identifiers: [],
        availableStock: itemData.availableStock || 0,
        availableIdentifiers: itemData.availableIdentifiers || []
      });
      renderCart();

      if (itemData.inventoryType === "imei") {
        openImeiSelectorModal(newIndex);
      }
    }
  };

  const renderCart = () => {
    const tbody = document.querySelector("#cartTableBody");
    const countEl = document.querySelector("#cartTotalItemsCount");
    if (!tbody) return;

    const totalItems = cart.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
    if (countEl) countEl.textContent = String(totalItems);

    if (cart.length === 0) {
      tbody.innerHTML = `
        <tr id="cartEmptyRow">
          <td class="text-center text-muted py-5" colspan="7">Chưa có sản phẩm nào trong giỏ hàng.</td>
        </tr>
      `;
      updateTotals();
      return;
    }

    tbody.innerHTML = cart
      .map((item, idx) => {
        let imeiHtml = `<span class="text-muted small">Theo số lượng</span>`;
        if (item.trackingType === "imei") {
          const isEnough = item.identifiers.length === item.quantity;
          const badges = item.identifiers
            .map((id) => `<span class="badge bg-light text-dark border me-1 mb-1">${id}</span>`)
            .join("");
          imeiHtml = `
            <div>${badges || '<span class="text-danger small">Chưa chọn mã IMEI</span>'}</div>
            <button type="button" class="btn btn-sm ${isEnough ? "btn-outline-primary" : "btn-warning"} py-0 px-2 mt-1 btn-open-imei-modal" data-index="${idx}">
              Chọn IMEI (${item.identifiers.length}/${item.quantity})
            </button>
          `;
        } else if (item.isCustomItem) {
          imeiHtml = `<span class="badge bg-info">Bán ngoài / Dịch vụ</span>`;
        }

        return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>
              <div class="fw-semibold text-primary">${item.productName}</div>
              ${item.variantName ? `<small class="text-muted d-block">${item.variantName}</small>` : ""}
              ${item.variantSku ? `<code class="text-dark">${item.variantSku}</code>` : ""}
            </td>
            <td class="text-end">${Number(item.unitPrice || 0).toLocaleString("vi-VN")} đ</td>
            <td class="text-center">
              <input type="number" class="form-control form-control-sm text-center cart-qty-input"
                data-index="${idx}" min="1" max="${item.isCustomItem ? 999 : item.availableStock}" value="${item.quantity}">
            </td>
            <td>${imeiHtml}</td>
            <td class="text-end fw-bold text-danger">${Number(item.totalPrice || 0).toLocaleString("vi-VN")} đ</td>
            <td class="text-center">
              <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-remove-cart-item" data-index="${idx}">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".cart-qty-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"), 10);
        const item = cart[idx];
        if (!item) return;
        let newQty = Math.max(1, parseInt(e.target.value, 10) || 1);
        if (!item.isCustomItem && newQty > item.availableStock) {
          newQty = item.availableStock;
          if (typeof notyf !== "undefined") notyf.error(`Tồn kho chỉ còn tối đa ${item.availableStock}!`);
        }
        item.quantity = newQty;
        if (item.trackingType === "imei" && item.identifiers.length > newQty) {
          item.identifiers = item.identifiers.slice(0, newQty);
        }
        item.totalPrice = item.quantity * item.unitPrice;
        renderCart();
      });
    });

    tbody.querySelectorAll(".btn-remove-cart-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        cart.splice(idx, 1);
        renderCart();
      });
    });

    tbody.querySelectorAll(".btn-open-imei-modal").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        openImeiSelectorModal(idx);
      });
    });

    updateTotals();
  };

  // Modal chọn IMEI
  const openImeiSelectorModal = async (cartIndex) => {
    const item = cart[cartIndex];
    if (!item || item.trackingType !== "imei") return;

    activeItemIndexForImei = cartIndex;
    tempSelectedImeis = [...(item.identifiers || [])];

    try {
      const res = await fetch(`/${pathAdmin}/order/api/available-imeis/${item.variantId}`);
      const data = await res.json();
      if (data.code === "success" && Array.isArray(data.identifiers)) {
        item.availableIdentifiers = data.identifiers;
      }
    } catch (e) {}

    const nameEl = document.querySelector("#modalImeiProductName");
    const reqEl = document.querySelector("#modalRequiredCount");
    const maxEl = document.querySelector("#modalMaxCount");
    const searchEl = document.querySelector("#modalImeiSearch");

    if (nameEl) nameEl.textContent = `${item.productName} (${item.variantName || item.variantSku})`;
    if (reqEl) reqEl.textContent = String(item.quantity);
    if (maxEl) maxEl.textContent = String(item.quantity);
    if (searchEl) searchEl.value = "";

    renderModalImeiList("");
    const modal = getModal("#selectImeiModal");
    if (modal) modal.show();
  };

  const renderModalImeiList = (filterText = "") => {
    const listContainer = document.querySelector("#modalImeiList");
    const selectedCountEl = document.querySelector("#modalSelectedCount");
    if (!listContainer || activeItemIndexForImei == null) return;

    const item = cart[activeItemIndexForImei];
    if (!item) return;

    if (selectedCountEl) selectedCountEl.textContent = String(tempSelectedImeis.length);

    const cleanFilter = filterText.trim().toUpperCase();
    const list = (item.availableIdentifiers || []).filter((id) => !cleanFilter || id.includes(cleanFilter));

    if (list.length === 0) {
      listContainer.innerHTML = `<div class="text-muted small">Không có mã IMEI phù hợp.</div>`;
      return;
    }

    listContainer.innerHTML = list
      .map((imei) => {
        const isSelected = tempSelectedImeis.includes(imei);
        return `
          <button type="button" class="btn btn-sm ${isSelected ? "btn-primary" : "btn-outline-secondary"} btn-modal-imei-item" data-imei="${imei}">
            <i class="fa-solid fa-barcode me-1"></i>${imei}
          </button>
        `;
      })
      .join("");

    listContainer.querySelectorAll(".btn-modal-imei-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const imei = btn.getAttribute("data-imei");
        if (tempSelectedImeis.includes(imei)) {
          tempSelectedImeis = tempSelectedImeis.filter((i) => i !== imei);
        } else {
          if (tempSelectedImeis.length >= item.quantity) {
            if (typeof notyf !== "undefined") notyf.error(`Chỉ cần chọn đủ ${item.quantity} mã IMEI!`);
            return;
          }
          tempSelectedImeis.push(imei);
        }
        const searchEl = document.querySelector("#modalImeiSearch");
        renderModalImeiList(searchEl ? searchEl.value : "");
      });
    });
  };

  document.querySelector("#modalImeiSearch")?.addEventListener("input", (e) => {
    renderModalImeiList(e.target.value);
  });

  document.querySelector("#btnConfirmImeis")?.addEventListener("click", () => {
    if (activeItemIndexForImei == null) return;
    const item = cart[activeItemIndexForImei];
    if (item) {
      item.identifiers = [...tempSelectedImeis];
      renderCart();
    }
    const modal = getModal("#selectImeiModal");
    if (modal) modal.hide();
  });

  // Modal thêm sản phẩm bán ngoài / dịch vụ
  document.querySelector("#btnOpenCustomItemModal")?.addEventListener("click", () => {
    const nameEl = document.querySelector("#customProductName");
    const priceEl = document.querySelector("#customUnitPrice");
    const qtyEl = document.querySelector("#customQuantity");
    if (nameEl) nameEl.value = "";
    if (priceEl) priceEl.value = "0";
    if (qtyEl) qtyEl.value = "1";
    const modal = getModal("#customItemModal");
    if (modal) modal.show();
  });

  document.querySelector("#btnAddCustomItem")?.addEventListener("click", () => {
    const typeEl = document.querySelector("#customItemType");
    const nameEl = document.querySelector("#customProductName");
    const priceEl = document.querySelector("#customUnitPrice");
    const qtyEl = document.querySelector("#customQuantity");

    const name = nameEl ? nameEl.value.trim() : "";
    const unitPrice = Math.max(0, parseFloat(priceEl ? priceEl.value : "0") || 0);
    const quantity = Math.max(1, parseInt(qtyEl ? qtyEl.value : "1", 10) || 1);
    const customItemType = typeEl ? typeEl.value : "custom_product";

    if (!name) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập tên sản phẩm hoặc dịch vụ!");
      return;
    }

    cart.push({
      isCustomItem: true,
      customItemType,
      productName: name,
      variantSku: customItemType === "custom_service" ? "DICH-VU" : "BAN-NGOAI",
      variantName: customItemType === "custom_service" ? "Dịch vụ / Tiền công" : "Sản phẩm bán ngoài",
      trackingType: "custom",
      unitPrice,
      quantity,
      discount: 0,
      totalPrice: unitPrice * quantity,
      identifiers: [],
      availableStock: 999
    });

    renderCart();
    const modal = getModal("#customItemModal");
    if (modal) modal.hide();
  });

  document.querySelector("#btnResetCart")?.addEventListener("click", () => {
    cart = [];
    renderCart();
  });

  // Tính tổng tiền & tiền thừa
  const getTotals = () => {
    const subTotal = cart.reduce((sum, i) => sum + Number(i.totalPrice || 0), 0);
    const discountInput = document.querySelector("#orderDiscountInput");
    const discount = Math.max(0, parseFloat(discountInput ? discountInput.value : "0") || 0);
    const total = Math.max(0, subTotal - discount);
    return { subTotal, discount, total };
  };

  const updateTotals = () => {
    const { subTotal, total } = getTotals();
    const subEl = document.querySelector("#subTotalDisplay");
    const totEl = document.querySelector("#totalAmountDisplay");
    const paidEl = document.querySelector("#paidAmountInput");
    const changeEl = document.querySelector("#changeAmountDisplay");

    if (subEl) subEl.textContent = `${subTotal.toLocaleString("vi-VN")} đ`;
    if (totEl) totEl.textContent = `${total.toLocaleString("vi-VN")} đ`;

    const paid = Math.max(0, parseFloat(paidEl && paidEl.value !== "" ? paidEl.value : String(total)) || 0);
    const change = Math.max(0, paid - total);
    if (changeEl) changeEl.textContent = `${change.toLocaleString("vi-VN")} đ`;
  };

  document.querySelector("#orderDiscountInput")?.addEventListener("input", updateTotals);
  document.querySelector("#paidAmountInput")?.addEventListener("input", updateTotals);
  document.querySelector("#btnExactAmount")?.addEventListener("click", () => {
    const { total } = getTotals();
    const paidEl = document.querySelector("#paidAmountInput");
    if (paidEl) paidEl.value = String(total);
    updateTotals();
  });

  // Tra cứu tự động khách hàng CRM theo SĐT
  const phoneInput = document.querySelector("#customerPhone");
  const nameInput = document.querySelector("#customerName");
  const addrInput = document.querySelector("#customerAddress");
  const badgeEl = document.querySelector("#customerLookupBadge");
  let phoneTimer = null;

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      clearTimeout(phoneTimer);
      const clean = phoneInput.value.replace(/\D/g, "");
      if (clean.length < 9) {
        if (badgeEl) badgeEl.style.display = "none";
        return;
      }
      phoneTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/${pathAdmin}/customer/lookup?phone=${encodeURIComponent(clean)}`);
          const data = await res.json();
          if (data.code === "success" && data.found && data.customer) {
            if (nameInput) nameInput.value = data.customer.fullName || "";
            if (addrInput && data.customer.address) addrInput.value = data.customer.address;
            if (badgeEl) {
              badgeEl.innerHTML = `<span class="badge bg-success">Khách quen: ${data.customer.fullName} (${data.customer.orderCount || 0} đơn)</span>`;
              badgeEl.style.display = "block";
            }
          } else if (badgeEl) {
            badgeEl.innerHTML = `<span class="badge bg-secondary">Khách hàng mới (sẽ tự lưu vào CRM)</span>`;
            badgeEl.style.display = "block";
          }
        } catch (e) {}
      }, 300);
    });
  }

  // Thanh toán & Xuất hóa đơn
  const btnCheckout = document.querySelector("#btnCheckout");
  if (btnCheckout) {
    btnCheckout.addEventListener("click", async () => {
      if (cart.length === 0) {
        if (typeof notyf !== "undefined") notyf.error("Giỏ hàng đang trống!");
        return;
      }

      for (let i = 0; i < cart.length; i++) {
        const it = cart[i];
        if (it.trackingType === "imei" && it.identifiers.length !== it.quantity) {
          if (typeof notyf !== "undefined") {
            notyf.error(`Vui lòng chọn đủ ${it.quantity} mã IMEI cho sản phẩm "${it.productName}"!`);
          }
          openImeiSelectorModal(i);
          return;
        }
      }

      const { discount } = getTotals();
      const paymentMethodEl = document.querySelector("#posPaymentMethod");
      const noteEl = document.querySelector("#orderNote");

      const payload = {
        customerInfo: {
          phone: phoneInput ? phoneInput.value.trim() : "",
          fullName: nameInput ? nameInput.value.trim() : "Khách lẻ tại quầy",
          address: addrInput ? addrInput.value.trim() : ""
        },
        items: cart,
        discount,
        paymentMethod: paymentMethodEl ? paymentMethodEl.value : "money",
        note: noteEl ? noteEl.value.trim() : ""
      };

      btnCheckout.disabled = true;
      try {
        const response = await fetch(`/${pathAdmin}/order/pos/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.code === "error") {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          btnCheckout.disabled = false;
          return;
        }

        if (data.code === "success") {
          if (typeof drawNotify === "function") drawNotify("success", data.message);
          window.location.href = `/${pathAdmin}/order/print/${data.orderId}`;
        }
      } catch (err) {
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối máy chủ!");
        btnCheckout.disabled = false;
      }
    });
  }
})();
