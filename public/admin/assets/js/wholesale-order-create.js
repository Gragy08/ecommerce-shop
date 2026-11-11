(function () {
  let cart = [];
  let activeItemIndexForImei = null;
  let tempSelectedImeis = [];

  const getModal = (selector) => {
    const el = document.querySelector(selector);
    return el && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(el) : null;
  };

  const searchInput = document.querySelector("#wholesaleSearchInput");
  const searchResults = document.querySelector("#wholesaleSearchResults");
  const clearSearchBtn = document.querySelector("#btnClearSearch");
  let searchDebounceTimer = null;

  // 1. Tìm kiếm sản phẩm sỉ & quét IMEI
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

  // Đóng dropdown khi click ra ngoài
  document.addEventListener("click", (e) => {
    if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.style.display = "none";
    }
  });

  const executeProductSearch = async (query) => {
    try {
      const res = await fetch(`/${pathAdmin}/wholesale/api/search-products?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.code === "warning") {
        if (typeof notyf !== "undefined") notyf.open({ type: "warning", message: data.message });
        return;
      }

      if (data.code !== "success") {
        if (typeof notyf !== "undefined") notyf.error(data.message || "Tìm kiếm thất bại!");
        return;
      }

      // Kịch bản 1: Quét trúng đích danh mã IMEI của 1 thiết bị
      if (data.isDirectImeiMatch && data.matchedImei) {
        addDeviceByDirectImei(data);
        if (searchInput) searchInput.value = "";
        if (clearSearchBtn) clearSearchBtn.style.display = "none";
        if (searchResults) searchResults.style.display = "none";
        return;
      }

      // Kịch bản 2: Danh sách kết quả theo tên hoặc SKU
      renderSearchResults(data.results || []);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const addDeviceByDirectImei = (data) => {
    const { product, variant, matchedImei, unitPrice, priceRetail, availableIdentifiers, availableStock } = data;
    const vIdStr = String(variant._id);

    const existingIndex = cart.findIndex((i) => String(i.variantId) === vIdStr);

    if (existingIndex > -1) {
      const item = cart[existingIndex];
      if (item.identifiers.includes(matchedImei)) {
        if (typeof notyf !== "undefined") notyf.open({ type: "warning", message: `Mã IMEI "${matchedImei}" đã có trong giỏ hàng sỉ!` });
        return;
      }
      if (item.quantity >= item.maxStock) {
        if (typeof notyf !== "undefined") notyf.open({ type: "warning", message: "Đã đạt số lượng tồn kho khả dụng tối đa!" });
        return;
      }
      item.quantity += 1;
      item.identifiers.push(matchedImei);
      item.totalPrice = item.unitPrice * item.quantity;
      if (typeof notyf !== "undefined") notyf.success(`Đã thêm IMEI: ${matchedImei}`);
    } else {
      const attrText = (variant.attributeValues || []).map((a) => a.label || a.value).filter(Boolean).join(" - ");
      cart.push({
        productId: String(product._id),
        productName: product.name,
        variantId: variant._id,
        variantSku: variant.sku,
        attributeText: attrText,
        inventoryType: "imei",
        unitPrice: Number(unitPrice || 0),
        priceRetail: Number(priceRetail || 0),
        isWholesalePriced: Boolean(data.isWholesalePriced),
        quantity: 1,
        totalPrice: Number(unitPrice || 0),
        identifiers: [matchedImei],
        availableIdentifiers: availableIdentifiers || [matchedImei],
        maxStock: availableStock || 1
      });
      if (typeof notyf !== "undefined") notyf.success(`Đã thêm: ${product.name} (${matchedImei})`);
    }

    renderCart();
  };

  const renderSearchResults = (results) => {
    if (!searchResults) return;

    if (!results || results.length === 0) {
      searchResults.innerHTML = '<div class="p-3 text-center text-muted small">Không tìm thấy sản phẩm nào khớp từ khóa.</div>';
      searchResults.style.display = "block";
      return;
    }

    let html = "";
    results.forEach((item, idx) => {
      const attrText = (item.attributeValues || []).map((a) => a.label || a.value).filter(Boolean).join(" - ");
      const hasStock = item.stock > 0;
      const wholesaleBadge = item.isWholesalePriced
        ? '<span class="badge bg-light text-dark border ms-1" style="font-size: 10px;">Giá sỉ</span>'
        : '<span class="badge bg-light text-muted border ms-1" style="font-size: 10px;">Giá lẻ</span>';

      html += `
        <div class="search-result-item d-flex align-items-center justify-content-between p-2 border-bottom ${hasStock ? 'cursor-pointer' : 'opacity-50'}" data-result-index="${idx}">
          <div class="d-flex align-items-center gap-2" style="max-width: 70%;">
            ${item.image ? `<img src="${item.image}" class="rounded" style="width: 38px; height: 38px; object-fit: cover;" />` : '<div class="bg-light rounded d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;"><i class="fa-solid fa-mobile-screen text-muted"></i></div>'}
            <div>
              <div class="fw-semibold text-truncate small" title="${item.productName}">${item.productName}</div>
              <div class="text-muted" style="font-size: 11px;">
                <code>${item.sku || 'N/A'}</code>
                ${attrText ? ` • <span>${attrText}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="text-end">
            <div class="fw-bold text-dark small">${Number(item.unitPrice || 0).toLocaleString("vi-VN")} đ ${wholesaleBadge}</div>
            <div class="small ${hasStock ? 'text-success' : 'text-danger'}" style="font-size: 11px;">
              ${hasStock ? `Kho: <strong>${item.stock}</strong>` : 'Hết hàng'}
            </div>
          </div>
        </div>
      `;
    });

    searchResults.innerHTML = html;
    searchResults.style.display = "block";

    searchResults.querySelectorAll(".search-result-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.getAttribute("data-result-index"), 10);
        const item = results[idx];
        if (!item || item.stock <= 0) {
          if (typeof notyf !== "undefined") notyf.open({ type: "warning", message: "Sản phẩm này hiện đang hết hàng!" });
          return;
        }
        addProductVariantToCart(item);
        if (searchInput) searchInput.value = "";
        if (clearSearchBtn) clearSearchBtn.style.display = "none";
        searchResults.style.display = "none";
      });
    });
  };

  const addProductVariantToCart = (item) => {
    const vIdStr = String(item.variantId);
    const existingIndex = cart.findIndex((i) => String(i.variantId) === vIdStr);

    if (existingIndex > -1) {
      const cItem = cart[existingIndex];
      if (cItem.quantity >= cItem.maxStock) {
        if (typeof notyf !== "undefined") notyf.open({ type: "warning", message: `Chỉ còn ${cItem.maxStock} sản phẩm trong kho!` });
        return;
      }
      cItem.quantity += 1;
      cItem.totalPrice = cItem.unitPrice * cItem.quantity;

      // Với hàng IMEI: nếu có sẵn mã chưa chọn thì gán tự động
      if (cItem.inventoryType === "imei") {
        const unselected = (cItem.availableIdentifiers || []).filter((id) => !cItem.identifiers.includes(id));
        if (unselected.length > 0) {
          cItem.identifiers.push(unselected[0]);
        }
      }
    } else {
      const attrText = (item.attributeValues || []).map((a) => a.label || a.value).filter(Boolean).join(" - ");
      let initialIdentifiers = [];
      if (item.inventoryType === "imei" && item.availableIdentifiers && item.availableIdentifiers.length > 0) {
        initialIdentifiers.push(item.availableIdentifiers[0]);
      }

      cart.push({
        productId: String(item.productId),
        productName: item.productName,
        variantId: item.variantId,
        variantSku: item.sku,
        attributeText: attrText,
        inventoryType: item.inventoryType || "imei",
        unitPrice: Number(item.unitPrice || 0),
        priceRetail: Number(item.priceRetail || 0),
        isWholesalePriced: Boolean(item.isWholesalePriced),
        quantity: 1,
        totalPrice: Number(item.unitPrice || 0),
        identifiers: initialIdentifiers,
        availableIdentifiers: item.availableIdentifiers || [],
        maxStock: item.stock || 1
      });
    }

    renderCart();
  };

  // 2. Render giỏ hàng sỉ
  const renderCart = () => {
    const tbody = document.querySelector("#cartTableBody");
    const countEl = document.querySelector("#cartTotalItemsCount");
    if (!tbody) return;

    if (countEl) countEl.textContent = String(cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0));

    if (cart.length === 0) {
      tbody.innerHTML = '<tr id="cartEmptyRow"><td class="text-center text-muted py-5" colspan="7">Chưa có sản phẩm nào trong giỏ hàng sỉ.</td></tr>';
      updateTotals();
      return;
    }

    let html = "";
    cart.forEach((item, index) => {
      const isImei = item.inventoryType === "imei";
      const selectedCount = item.identifiers ? item.identifiers.length : 0;
      const isFull = selectedCount === item.quantity;

      let imeiCellHtml = "";
      if (isImei) {
        const imeiPreview = (item.identifiers || []).slice(0, 2).map((id) => `<code class="bg-light border px-1 py-0 rounded text-dark" style="font-size: 11px;">${id}</code>`).join(" ");
        const moreCount = selectedCount > 2 ? `<span class="badge bg-light text-muted border">+${selectedCount - 2}</span>` : "";

        imeiCellHtml = `
          <div>
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="small ${isFull ? 'text-success' : 'text-danger'}" style="font-size: 11px;">
                ${isFull ? `Đã chọn: ${selectedCount}/${item.quantity}` : `Thiếu IMEI: ${selectedCount}/${item.quantity}`}
              </span>
              <button class="btn btn-outline-secondary btn-sm py-0 px-2 btn-open-imei-modal" data-cart-index="${index}" type="button" style="font-size: 11px;">
                Chọn mã
              </button>
            </div>
            <div class="d-flex flex-wrap gap-1">${imeiPreview} ${moreCount}</div>
          </div>
        `;
      } else {
        imeiCellHtml = '<span class="small text-muted">Hàng phụ kiện / số lượng</span>';
      }

      html += `
        <tr data-cart-index="${index}">
          <td class="text-center text-muted small">${index + 1}</td>
          <td>
            <div class="fw-semibold small">${item.productName}</div>
            <div class="text-muted" style="font-size: 11px;">
              <code>${item.variantSku || 'N/A'}</code>
              ${item.attributeText ? ` • <span>${item.attributeText}</span>` : ''}
            </div>
          </td>
          <td class="text-end">
            <input type="number" min="0" step="1000" class="form-control form-control-sm text-end input-item-price" data-cart-index="${index}" value="${item.unitPrice}" style="width: 120px; display: inline-block;" />
          </td>
          <td class="text-center">
            <div class="input-group input-group-sm justify-content-center" style="width: 105px; margin: 0 auto;">
              <button class="btn btn-outline-secondary btn-decrease-qty" data-cart-index="${index}" type="button">-</button>
              <input type="number" min="1" max="${item.maxStock}" class="form-control text-center input-item-qty" data-cart-index="${index}" value="${item.quantity}" />
              <button class="btn btn-outline-secondary btn-increase-qty" data-cart-index="${index}" type="button">+</button>
            </div>
          </td>
          <td>${imeiCellHtml}</td>
          <td class="text-end fw-semibold text-dark small">${Number(item.totalPrice || 0).toLocaleString("vi-VN")} đ</td>
          <td class="text-center">
            <a href="javascript:;" class="text-danger btn-remove-item" data-cart-index="${index}" title="Xóa">
              <i class="fa-solid fa-trash"></i>
            </a>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Gắn sự kiện các nút trong giỏ
    tbody.querySelectorAll(".btn-increase-qty").forEach((b) => {
      b.addEventListener("click", () => {
        const idx = parseInt(b.getAttribute("data-cart-index"), 10);
        updateCartItemQuantity(idx, cart[idx].quantity + 1);
      });
    });

    tbody.querySelectorAll(".btn-decrease-qty").forEach((b) => {
      b.addEventListener("click", () => {
        const idx = parseInt(b.getAttribute("data-cart-index"), 10);
        if (cart[idx].quantity > 1) {
          updateCartItemQuantity(idx, cart[idx].quantity - 1);
        } else {
          removeCartItem(idx);
        }
      });
    });

    tbody.querySelectorAll(".input-item-qty").forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const idx = parseInt(inp.getAttribute("data-cart-index"), 10);
        const val = parseInt(e.target.value, 10) || 1;
        updateCartItemQuantity(idx, val);
      });
    });

    tbody.querySelectorAll(".input-item-price").forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const idx = parseInt(inp.getAttribute("data-cart-index"), 10);
        const val = Math.max(0, parseFloat(e.target.value) || 0);
        cart[idx].unitPrice = val;
        cart[idx].totalPrice = val * cart[idx].quantity;
        renderCart();
      });
    });

    tbody.querySelectorAll(".btn-remove-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-cart-index"), 10);
        removeCartItem(idx);
      });
    });

    tbody.querySelectorAll(".btn-open-imei-modal").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-cart-index"), 10);
        openImeiModal(idx);
      });
    });

    updateTotals();
  };

  const updateCartItemQuantity = (index, newQty) => {
    const item = cart[index];
    if (!item) return;

    if (newQty > item.maxStock) {
      if (typeof notyf !== "undefined") notyf.open({ type: "warning", message: `Kho chỉ còn ${item.maxStock} cái!` });
      newQty = item.maxStock;
    }

    if (newQty < 1) newQty = 1;

    item.quantity = newQty;
    item.totalPrice = item.unitPrice * newQty;

    // Nếu là hàng IMEI và số lượng giảm, tự động cắt bớt identifiers thừa
    if (item.inventoryType === "imei") {
      if (item.identifiers.length > newQty) {
        item.identifiers = item.identifiers.slice(0, newQty);
      } else if (item.identifiers.length < newQty) {
        // Tự động gán thêm IMEI còn trống nếu có
        const unselected = (item.availableIdentifiers || []).filter((id) => !item.identifiers.includes(id));
        while (item.identifiers.length < newQty && unselected.length > 0) {
          item.identifiers.push(unselected.shift());
        }
      }
    }

    renderCart();
  };

  const removeCartItem = (index) => {
    cart.splice(index, 1);
    renderCart();
  };

  document.querySelector("#btnResetCart")?.addEventListener("click", () => {
    if (cart.length === 0) return;
    if (confirm("Bạn có chắc muốn làm mới giỏ hàng sỉ?")) {
      cart = [];
      renderCart();
    }
  });

  // 3. Modal chọn IMEI & Dán danh sách hàng loạt
  const openImeiModal = (cartIndex) => {
    activeItemIndexForImei = cartIndex;
    const item = cart[cartIndex];
    if (!item) return;

    tempSelectedImeis = [...(item.identifiers || [])];

    const prodNameEl = document.querySelector("#modalImeiProductName");
    const reqCountEl = document.querySelector("#modalRequiredCount");
    const selCountEl = document.querySelector("#modalSelectedCount");
    const maxCountEl = document.querySelector("#modalMaxCount");
    const searchInp = document.querySelector("#modalImeiSearch");
    const batchTextarea = document.querySelector("#modalBatchImeiTextarea");
    const batchFeedback = document.querySelector("#batchImeiFeedback");

    if (prodNameEl) prodNameEl.textContent = `${item.productName} (${item.variantSku})`;
    if (reqCountEl) reqCountEl.textContent = String(item.quantity);
    if (maxCountEl) maxCountEl.textContent = String(item.quantity);
    if (searchInp) searchInp.value = "";
    if (batchTextarea) batchTextarea.value = (item.identifiers || []).join("\n");
    if (batchFeedback) batchFeedback.textContent = `Đang chọn ${tempSelectedImeis.length} mã`;

    renderModalImeisList("");

    // Reset về tab 1
    const tab1Trigger = document.querySelector("#tabSelectAvailable-tab");
    if (tab1Trigger && window.bootstrap) {
      const tabInstance = new window.bootstrap.Tab(tab1Trigger);
      tabInstance.show();
    }

    const modal = getModal("#selectImeiModal");
    if (modal) modal.show();
  };

  const renderModalImeisList = (filterKeyword) => {
    const listEl = document.querySelector("#modalImeiList");
    const selCountEl = document.querySelector("#modalSelectedCount");
    if (!listEl || activeItemIndexForImei === null) return;

    const item = cart[activeItemIndexForImei];
    if (!item) return;

    const available = item.availableIdentifiers || [];
    const filter = (filterKeyword || "").trim().toUpperCase();

    const filtered = filter ? available.filter((id) => id.toUpperCase().includes(filter)) : available;

    if (selCountEl) selCountEl.textContent = String(tempSelectedImeis.length);

    if (filtered.length === 0) {
      listEl.innerHTML = '<span class="text-muted small w-100 text-center py-3">Không có mã IMEI nào phù hợp.</span>';
      return;
    }

    let html = "";
    filtered.forEach((imei) => {
      const isSelected = tempSelectedImeis.includes(imei);
      html += `
        <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'} btn-imei-chip" data-imei="${imei}" style="font-size: 12px; font-family: monospace;">
          ${imei}
        </button>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll(".btn-imei-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const imei = btn.getAttribute("data-imei");
        toggleImeiSelection(imei);
      });
    });
  };

  const toggleImeiSelection = (imei) => {
    if (activeItemIndexForImei === null) return;
    const item = cart[activeItemIndexForImei];
    if (!item) return;

    const idx = tempSelectedImeis.indexOf(imei);
    if (idx > -1) {
      tempSelectedImeis.splice(idx, 1);
    } else {
      if (tempSelectedImeis.length >= item.quantity) {
        if (typeof notyf !== "undefined") notyf.open({ type: "warning", message: `Sản phẩm này chỉ yêu cầu ${item.quantity} mã IMEI!` });
        return;
      }
      tempSelectedImeis.push(imei);
    }

    const searchInp = document.querySelector("#modalImeiSearch");
    renderModalImeisList(searchInp ? searchInp.value : "");
  };

  document.querySelector("#modalImeiSearch")?.addEventListener("input", (e) => {
    renderModalImeisList(e.target.value);
  });

  // Áp dụng dán IMEI hàng loạt
  document.querySelector("#btnApplyBatchImei")?.addEventListener("click", () => {
    if (activeItemIndexForImei === null) return;
    const item = cart[activeItemIndexForImei];
    if (!item) return;

    const textarea = document.querySelector("#modalBatchImeiTextarea");
    const feedback = document.querySelector("#batchImeiFeedback");
    if (!textarea) return;

    const rawText = textarea.value;
    const rawList = rawText.split(/[\r\n,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);

    const available = item.availableIdentifiers || [];
    const validMatches = [];
    const invalidList = [];

    rawList.forEach((id) => {
      if (available.includes(id)) {
        if (!validMatches.includes(id)) {
          if (validMatches.length < item.quantity) {
            validMatches.push(id);
          }
        }
      } else {
        invalidList.push(id);
      }
    });

    tempSelectedImeis = validMatches;
    renderModalImeisList("");

    if (feedback) {
      let msg = `Đã khớp ${validMatches.length}/${item.quantity} mã khả dụng.`;
      if (invalidList.length > 0) {
        msg += ` (${invalidList.length} mã không có trong kho)`;
      }
      feedback.textContent = msg;
    }

    if (typeof notyf !== "undefined") {
      notyf.success(`Đã nhận diện ${validMatches.length} mã IMEI từ danh sách dán!`);
    }
  });

  document.querySelector("#btnConfirmImeis")?.addEventListener("click", () => {
    if (activeItemIndexForImei === null) return;
    const item = cart[activeItemIndexForImei];
    if (!item) return;

    item.identifiers = [...tempSelectedImeis];
    renderCart();

    const modal = getModal("#selectImeiModal");
    if (modal) modal.hide();
  });

  // 4. Chọn Đại lý & Hiển thị thông tin
  const dealerSelect = document.querySelector("#dealerSelect");
  const dealerSearchInput = document.querySelector("#dealerSearchInput");
  const clearDealerSearchBtn = document.querySelector("#btnClearDealerSearch");
  const dealerDetailsSection = document.querySelector("#dealerDetailsSection");
  const dealerStoreName = document.querySelector("#dealerStoreName");
  const dealerFullName = document.querySelector("#dealerFullName");
  const dealerPhone = document.querySelector("#dealerPhone");
  const dealerTaxCode = document.querySelector("#dealerTaxCode");
  const dealerAddress = document.querySelector("#dealerAddress");

  const normalizeStr = (str) => {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  };

  if (dealerSearchInput && dealerSelect) {
    const filterDealerOptions = () => {
      const q = normalizeStr(dealerSearchInput.value);
      if (clearDealerSearchBtn) clearDealerSearchBtn.style.display = q ? "block" : "none";

      const tokens = q.split(/\s+/).filter(Boolean);
      let matchCount = 0;
      let firstMatchedOption = null;

      for (let i = 1; i < dealerSelect.options.length; i++) {
        const opt = dealerSelect.options[i];
        if (!tokens.length) {
          opt.hidden = false;
          opt.style.display = "";
          continue;
        }

        const text = normalizeStr(opt.textContent || "");
        const store = normalizeStr(opt.getAttribute("data-store-name") || "");
        const name = normalizeStr(opt.getAttribute("data-full-name") || "");
        const phone = (opt.getAttribute("data-phone") || "").replace(/\D/g, "");
        const tax = normalizeStr(opt.getAttribute("data-tax-code") || "");
        const combined = `${text} ${store} ${name} ${phone} ${tax}`;

        const isMatch = tokens.every((token) => combined.includes(token));
        if (isMatch) {
          opt.hidden = false;
          opt.style.display = "";
          matchCount++;
          if (!firstMatchedOption) firstMatchedOption = opt;
        } else {
          opt.hidden = true;
          opt.style.display = "none";
        }
      }
      return { matchCount, firstMatchedOption };
    };

    dealerSearchInput.addEventListener("input", filterDealerOptions);

    dealerSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const { matchCount, firstMatchedOption } = filterDealerOptions();
        if (matchCount === 1 && firstMatchedOption) {
          dealerSelect.value = firstMatchedOption.value;
          dealerSelect.dispatchEvent(new Event("change"));
          if (typeof notyf !== "undefined") {
            notyf.success(`Đã chọn: ${firstMatchedOption.getAttribute("data-store-name") || firstMatchedOption.textContent}`);
          }
        }
      }
    });

    if (clearDealerSearchBtn) {
      clearDealerSearchBtn.addEventListener("click", () => {
        dealerSearchInput.value = "";
        clearDealerSearchBtn.style.display = "none";
        filterDealerOptions();
        dealerSearchInput.focus();
      });
    }
  }

  if (dealerSelect) {
    dealerSelect.addEventListener("change", () => {
      const selectedOption = dealerSelect.options[dealerSelect.selectedIndex];
      if (!selectedOption || !selectedOption.value) {
        if (dealerDetailsSection) dealerDetailsSection.style.display = "none";
        return;
      }

      if (dealerStoreName) dealerStoreName.value = selectedOption.getAttribute("data-store-name") || "";
      if (dealerFullName) dealerFullName.value = selectedOption.getAttribute("data-full-name") || "";
      if (dealerPhone) dealerPhone.value = selectedOption.getAttribute("data-phone") || "";
      if (dealerTaxCode) dealerTaxCode.value = selectedOption.getAttribute("data-tax-code") || "";
      if (dealerAddress) dealerAddress.value = selectedOption.getAttribute("data-address") || "";

      if (dealerDetailsSection) dealerDetailsSection.style.display = "block";
    });
  }

  // 5. Tính toán thành tiền & Kiểm tra điều kiện chính sách sỉ
  const debtSection = document.querySelector("#debtPaymentSection");
  const debtDownPaymentInput = document.querySelector("#debtDownPaymentInput");
  const debtRemainingDisplay = document.querySelector("#debtRemainingAmountDisplay");
  const btnDebtZero = document.querySelector("#btnDebtZero");

  const getTotals = () => {
    const subTotal = cart.reduce((sum, i) => sum + Number(i.totalPrice || 0), 0);
    const discountInput = document.querySelector("#orderDiscountInput");
    const discount = Math.max(0, parseFloat(discountInput ? discountInput.value : "0") || 0);
    const total = Math.max(0, subTotal - discount);
    const totalQuantity = cart.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    return { subTotal, discount, total, totalQuantity };
  };

  const updateTotals = () => {
    const { subTotal, total, totalQuantity } = getTotals();
    const subEl = document.querySelector("#subTotalDisplay");
    const totEl = document.querySelector("#totalAmountDisplay");
    const paidEl = document.querySelector("#paidAmountInput");
    const changeEl = document.querySelector("#changeAmountDisplay");

    if (subEl) subEl.textContent = `${subTotal.toLocaleString("vi-VN")} đ`;
    if (totEl) totEl.textContent = `${total.toLocaleString("vi-VN")} đ`;

    const isDebt = paymentMethodSelect && paymentMethodSelect.value === "debt";

    if (isDebt) {
      const downPayment = Math.max(0, parseFloat(debtDownPaymentInput ? debtDownPaymentInput.value : "0") || 0);
      const remainingDebt = Math.max(0, total - downPayment);
      if (debtRemainingDisplay) {
        debtRemainingDisplay.textContent = `${remainingDebt.toLocaleString("vi-VN")} đ`;
      }
      if (paymentStatusSelect) {
        paymentStatusSelect.value = remainingDebt === 0 && total > 0 ? "paid" : "unpaid";
      }
    } else {
      const paid = Math.max(0, parseFloat(paidEl && paidEl.value !== "" ? paidEl.value : String(total)) || 0);
      const change = Math.max(0, paid - total);
      if (changeEl) changeEl.textContent = `${change.toLocaleString("vi-VN")} đ`;
    }

    // Cập nhật thanh điều kiện sỉ
    const curQtyEl = document.querySelector("#policyCurrentQuantity");
    const curTotEl = document.querySelector("#policyCurrentTotal");
    const statusBadge = document.querySelector("#policyStatusBadge");
    const overrideSection = document.querySelector("#overridePolicySection");

    if (curQtyEl) curQtyEl.textContent = String(totalQuantity);
    if (curTotEl) curTotEl.textContent = `${subTotal.toLocaleString("vi-VN")} đ`;

    const isPolicyPassed = totalQuantity >= policyMinQuantity || subTotal >= policyMinOrderTotal;

    if (statusBadge) {
      if (isPolicyPassed) {
        statusBadge.className = "badge bg-success";
        statusBadge.textContent = "Đạt điều kiện giá sỉ";
        if (overrideSection) overrideSection.style.display = "none";
      } else {
        statusBadge.className = "badge bg-warning text-dark";
        statusBadge.textContent = "Chưa đạt điều kiện sỉ";
        if (overrideSection) overrideSection.style.display = "block";
      }
    }
  };

  document.querySelector("#orderDiscountInput")?.addEventListener("input", updateTotals);
  document.querySelector("#paidAmountInput")?.addEventListener("input", updateTotals);
  debtDownPaymentInput?.addEventListener("input", updateTotals);

  btnDebtZero?.addEventListener("click", () => {
    if (debtDownPaymentInput) debtDownPaymentInput.value = "0";
    updateTotals();
  });

  document.querySelector("#btnExactAmount")?.addEventListener("click", () => {
    const { total } = getTotals();
    const paidEl = document.querySelector("#paidAmountInput");
    if (paidEl) paidEl.value = String(total);
    updateTotals();
  });

  // Hiển thị khung tiền tương ứng hình thức thanh toán
  const paymentStatusSelect = document.querySelector("#paymentStatus");
  const paymentMethodSelect = document.querySelector("#paymentMethod");
  const paidSection = document.querySelector("#paidAmountSection");

  const togglePaymentSections = () => {
    if (!paymentMethodSelect) return;
    const method = paymentMethodSelect.value;
    const isPaid = paymentStatusSelect ? paymentStatusSelect.value === "paid" : true;

    if (method === "debt") {
      if (debtSection) debtSection.style.display = "block";
      if (paidSection) paidSection.style.display = "none";
    } else if (method === "money") {
      if (debtSection) debtSection.style.display = "none";
      if (paidSection) paidSection.style.display = isPaid ? "block" : "none";
    } else {
      if (debtSection) debtSection.style.display = "none";
      if (paidSection) paidSection.style.display = "none";
    }
    updateTotals();
  };

  paymentStatusSelect?.addEventListener("change", togglePaymentSections);
  paymentMethodSelect?.addEventListener("change", togglePaymentSections);

  // Khởi tạo trạng thái ban đầu của khung thanh toán
  togglePaymentSections();

  // 6. Gửi đơn hàng sỉ (Submit)
  const btnSubmit = document.querySelector("#btnSubmitWholesaleOrder");
  if (btnSubmit) {
    btnSubmit.addEventListener("click", async () => {
      // 1. Kiểm tra chọn đại lý
      const dealerId = dealerSelect ? dealerSelect.value : "";
      if (!dealerId) {
        if (typeof notyf !== "undefined") notyf.error("Vui lòng chọn đại lý nhận hàng!");
        dealerSelect?.focus();
        return;
      }

      // 2. Kiểm tra giỏ hàng
      if (cart.length === 0) {
        if (typeof notyf !== "undefined") notyf.error("Giỏ hàng sỉ đang trống. Vui lòng thêm sản phẩm!");
        searchInput?.focus();
        return;
      }

      // 3. Kiểm tra mã IMEI đủ số lượng
      for (let idx = 0; idx < cart.length; idx++) {
        const item = cart[idx];
        if (item.inventoryType === "imei") {
          const selCount = item.identifiers ? item.identifiers.length : 0;
          if (selCount !== item.quantity) {
            if (typeof notyf !== "undefined") {
              notyf.error(`Sản phẩm "${item.productName}" yêu cầu ${item.quantity} mã IMEI nhưng mới chọn ${selCount} mã!`);
            }
            openImeiModal(idx);
            return;
          }
        }
      }

      // 4. Kiểm tra điều kiện chính sách sỉ
      const { subTotal, discount, total, totalQuantity } = getTotals();
      const isPolicyPassed = totalQuantity >= policyMinQuantity || subTotal >= policyMinOrderTotal;
      const isOverride = document.querySelector("#isPolicyOverride")?.checked || false;

      if (!isPolicyPassed && !isOverride) {
        if (typeof notyf !== "undefined") {
          notyf.error(`Đơn sỉ chưa đạt điều kiện (tối thiểu ${policyMinQuantity} máy hoặc từ ${policyMinOrderTotal.toLocaleString("vi-VN")} đ)! Vui lòng bổ sung hoặc tích "Cho phép xuất giá sỉ ngoại lệ".`);
        }
        return;
      }

      const deliveryMethod = document.querySelector("#deliveryMethod")?.value || "pickup";
      const paymentMethod = document.querySelector("#paymentMethod")?.value || "bank_transfer";
      const isDebt = paymentMethod === "debt";

      const downPayment = isDebt ? Math.max(0, parseFloat(debtDownPaymentInput?.value || "0") || 0) : 0;
      const rawPaid = parseFloat(document.querySelector("#paidAmountInput")?.value || String(total)) || 0;
      const paidAmount = isDebt ? downPayment : (document.querySelector("#paymentStatus")?.value === "paid" ? total : rawPaid);

      const paymentStatus = isDebt
        ? (downPayment >= total && total > 0 ? "paid" : "unpaid")
        : (document.querySelector("#paymentStatus")?.value || "paid");

      const note = document.querySelector("#orderNote")?.value || "";

      const payload = {
        dealerId,
        fullName: dealerFullName ? dealerFullName.value : "",
        phone: dealerPhone ? dealerPhone.value : "",
        address: dealerAddress ? dealerAddress.value : "",
        deliveryMethod,
        items: cart.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          variantSku: i.variantSku,
          quantity: i.quantity,
          price: i.unitPrice,
          identifiers: i.identifiers || []
        })),
        discount,
        paymentMethod,
        paymentStatus,
        paidAmount,
        downPayment,
        note,
        isPolicyOverride: isOverride
      };

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang tạo đơn...';

      try {
        const response = await fetch(`/${pathAdmin}/wholesale/orders/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.code === "error") {
          if (typeof notyf !== "undefined") notyf.error(data.message);
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<i class="fa-solid fa-check me-1"></i> Tạo đơn hàng sỉ';
          return;
        }

        if (data.code === "success") {
          if (typeof drawNotify === "function") {
            drawNotify("success", data.message);
          } else if (typeof notyf !== "undefined") {
            notyf.success(data.message);
          }

          // Chuyển hướng sang in hóa đơn hoặc danh sách đơn hàng
          setTimeout(() => {
            window.location.href = `/${pathAdmin}/order/print/${data.orderId}`;
          }, 1000);
        }
      } catch (err) {
        console.error("Wholesale submit error:", err);
        if (typeof notyf !== "undefined") notyf.error("Không thể kết nối máy chủ! Vui lòng thử lại.");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-check me-1"></i> Tạo đơn hàng sỉ';
      }
    });
  }
})();
