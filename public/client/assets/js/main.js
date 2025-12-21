// Create an instance of Notyf
var notyf = new Notyf({
  duration: 3000,
  position: {
    x:'right',
    y:'top'
  },
  dismissible: true
});

const notifyData = sessionStorage.getItem("notify");
if(notifyData) {
  const { type, message } = JSON.parse(notifyData);
  if(type == "error") {
    notyf.error(message);
  } else if(type == "success") {
    notyf.success(message);
  }
  sessionStorage.removeItem("notify");
}

const drawNotify = (type, message) => {
  sessionStorage.setItem("notify", JSON.stringify({
    type: type,
    message: message
  }));
}

// pagination
const pagination = document.querySelector(".pagination");
if(pagination) {
  const url = new URL(window.location.href);

  const listItem = pagination.querySelectorAll(".page-item [page]");
  listItem.forEach(item => {
    item.addEventListener("click", () => {
      const value = item.getAttribute("page");
      if(value) {
        url.searchParams.set("page", value);
      } else {
        url.searchParams.delete("page");
      }
      window.location.href = url.href;
    })
  })
}
// End pagination

// button-share
const listButtonShare = document.querySelectorAll("[button-share]");
if(listButtonShare.length > 0) {
  listButtonShare.forEach(button => {
    button.href = button.href + window.location.href;
    // button.href = button.href + "https://28tech.com.vn/lap-trinh-backend-nodejs-middle";
  })
}
// End button-share

// filter-product-status
const listFilterProductStatus = document.querySelectorAll("[filter-product-status]");
if(listFilterProductStatus.length > 0) {
  const url = new URL(window.location.href);
  
  listFilterProductStatus.forEach(input => {
    const name = input.value;
    
    input.addEventListener("change", () => {
      const value = input.checked;
      if(value) {
        url.searchParams.set(name, value);
      } else {
        url.searchParams.delete(name);
      }
      window.location.href = url.href;
    })

    // Hiển thị giá trị mặc định
    const valueCurrent = url.searchParams.get(name);
    if(valueCurrent) {
      input.checked = true;
    }
  })
}
// End filter-product-status

// button-slug
const listButtonSlug = document.querySelectorAll("[button-slug]");
if(listButtonSlug.length > 0) {
  const url = new URL(window.location.href);
  
  listButtonSlug.forEach(button => {
    button.addEventListener("click", () => {
      const slug = button.getAttribute("button-slug");
      if(slug) {
        url.pathname = `/product/category/${slug}`;
        window.location.href = url.href;
      }
    })
  })
}
// End button-slug

// filter-attribute
const listFilterAttribute = document.querySelectorAll("[filter-attribute]");
if(listFilterAttribute.length > 0) {
  const url = new URL(window.location.href);

  listFilterAttribute.forEach(filterAttribute => {
    const id = filterAttribute.getAttribute("filter-attribute");
    const listInput = filterAttribute.querySelectorAll(`input[type="checkbox"]`);
    
    listInput.forEach(input => {
      input.addEventListener("change", () => {
        const listInputChecked = filterAttribute.querySelectorAll(`input[type="checkbox"]:checked`);
        const listValue = [];
        listInputChecked.forEach(inputChecked => listValue.push(inputChecked.value));
        if(listValue.length > 0) {
          url.searchParams.set(`attribute_${id}`, listValue.join(","));
        } else {
          url.searchParams.delete(`attribute_${id}`);
        }
        window.location.href = url.href;
      })
    })

    // Hiển thị giá trị mặc định
    const listValueCurrent = url.searchParams.get(`attribute_${id}`);
    if(listValueCurrent) {
      const listValue = listValueCurrent.split(",");
      listInput.forEach(input => {
        if(listValue.includes(input.value)) {
          input.checked = true;
        }
      })
    }
  })
}
// End filter-attribute

// form-search
const formSearch = document.querySelector("[form-search]");
if(formSearch) {
  const url = new URL(window.location.href);

  // Hiển thị giá trị mặc định
  const categoryCurrent = url.pathname.split("/").pop();
  const keywordCurrent = url.searchParams.get("keyword");
  
  if(categoryCurrent && categoryCurrent != "category") {
    formSearch.category.value = categoryCurrent;
  }

  if(keywordCurrent) {
    formSearch.keyword.value = keywordCurrent;
  }
  
  formSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    const category = event.target.category.value;
    const keyword = event.target.keyword.value;
    
    if(category) {
      url.pathname = `/product/category/${category}`;
    } else {
      url.pathname = `/product/category`;
    }

    if(keyword) {
      url.searchParams.set("keyword", keyword);
    } else {
      url.searchParams.delete("keyword");
    }

    window.location.href = url.href;
  })

  // button-voice
  const buttonVoice = document.querySelector("[button-voice]");
  if(buttonVoice) {
    buttonVoice.addEventListener("click", () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const voice = new SpeechRecognition();
      voice.lang = "vi-VN";
      voice.start();
      voice.onresult = (event) => {
        const value = event.results[0][0].transcript;
        if(value) {
          formSearch.keyword.value = value;
          formSearch.submit();
        }
      };
    })
  }
  // End button-voice

  // Suggest
  const input = formSearch.querySelector(`input[name="keyword"]`);
  const boxSuggest = formSearch.querySelector(`.inner-suggest`);
  const boxSuggestList = boxSuggest.querySelector(`.inner-list`);
  let timeout;

  input.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const keyword = input.value;
      if(keyword) {
        fetch(`/product/suggest?keyword=${keyword}`)
          .then(res => res.json())
          .then(data => {
            if(data.code == "success") {
              const htmlArray = data.list.map(item => {
                return `
                  <a class="inner-item" href="/product/detail/${item.slug}">
                    <img class="inner-image" src="${domainCDN}${item.images[0]}">
                    <div class="inner-info">
                      <div class="inner-name">${item.name}</div>
                      <div class="inner-prices">
                        <div class="inner-price-new">
                          ${item.priceNew.toLocaleString("vi-VN")}đ
                        </div>
                        <div class="inner-price-old">
                          ${item.priceOld.toLocaleString("vi-VN")}đ
                        </div>
                      </div>
                    </div>
                  </a>
                `;
              })
              boxSuggestList.innerHTML = htmlArray.join("");
              if(data.list.length > 0) {
                boxSuggest.style.display = "block";
              } else {
                boxSuggest.style.display = "none";
              }
            }
          })
      } else {
        boxSuggest.style.display = "none";
      }
    }, 500);
  })
  // End Suggest
}
// End form-search

// Tạo giỏ hàng mới
const existCart = localStorage.getItem("cart");
if(!existCart) {
  localStorage.setItem("cart", JSON.stringify([]));
}
// Hết Tạo giỏ hàng mới

// mini-cart-quantity
const miniCartQuantity = () => {
  const cart = JSON.parse(localStorage.getItem("cart"));
  const listElementMiniCartQuantity = document.querySelectorAll("[mini-cart-quantity]");
  listElementMiniCartQuantity.forEach(item => {
    item.innerHTML = cart.length;
  });
}
miniCartQuantity();
// End mini-cart-quantity

// Xóa item trong giỏ hàng
const eventRemoveItemInCart = () => {
  const listButtonRemoveItem = document.querySelectorAll("[button-remove-item]");
  listButtonRemoveItem.forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest("[cart-item]");
      const productId = item.getAttribute("product-id");
      let variant = item.getAttribute("variant");
      if(variant) {
        variant = JSON.parse(decodeURIComponent(variant));
      }
      
      let cart = JSON.parse(localStorage.getItem("cart"));
      cart = cart.filter(cartItem => {
        // So sánh giống productId
        const sameProduct = cartItem.productId == productId;

        // So sánh giống variant
        const variantItemInCart = cartItem.variant ? JSON.stringify(cartItem.variant) : "[]";
        const variantItemRemove = variant ? JSON.stringify(variant) : "[]";
        const sameVariant = variantItemInCart == variantItemRemove;

        return !(sameProduct && sameVariant);
      });
      
      localStorage.setItem("cart", JSON.stringify(cart));
      drawCart();
      miniCartQuantity();
    })
  })
}
// Hết Xóa item trong giỏ hàng

// Check item trong giỏ hàng
const eventCheckItemInCart = () => {
  const listInputCheckItem = document.querySelectorAll("[cart-table] .cart_page_checkbox input");
  listInputCheckItem.forEach(input => {
    input.addEventListener("change", () => {
      const checked = input.checked;
      const item = input.closest("[cart-item]");
      const productId = item.getAttribute("product-id");
      let variant = item.getAttribute("variant");
      if(variant) {
        variant = JSON.parse(decodeURIComponent(variant));
      }
      
      const cart = JSON.parse(localStorage.getItem("cart"));
      const itemUpdate = cart.find(cartItem => {
        // So sánh giống productId
        const sameProduct = cartItem.productId == productId;

        // So sánh giống variant
        const variantItemInCart = cartItem.variant ? JSON.stringify(cartItem.variant) : "[]";
        const variantItemRemove = variant ? JSON.stringify(variant) : "[]";
        const sameVariant = variantItemInCart == variantItemRemove;

        return (sameProduct && sameVariant);
      })

      itemUpdate.checked = checked;
      localStorage.setItem("cart", JSON.stringify(cart));
      drawCart();
    })
  })
}
// Hết Check item trong giỏ hàng

// Cập nhật số lượng item trong giỏ hàng
const eventQuantityItemInCart = () => {
  const listBoxQuantity = document.querySelectorAll("[cart-table] .cart_page_quantity");
  listBoxQuantity.forEach(box => {
    const inputQuantity = box.querySelector("input");
    const buttonPlus = box.querySelector(".plus");
    const buttonMinus = box.querySelector(".minus");

    const item = box.closest("[cart-item]");
    const productId = item.getAttribute("product-id");
    let variant = item.getAttribute("variant");
    if(variant) {
      variant = JSON.parse(decodeURIComponent(variant));
    }

    const cart = JSON.parse(localStorage.getItem("cart"));
    const itemUpdate = cart.find(cartItem => {
      // So sánh giống productId
      const sameProduct = cartItem.productId == productId;

      // So sánh giống variant
      const variantItemInCart = cartItem.variant ? JSON.stringify(cartItem.variant) : "[]";
      const variantItemRemove = variant ? JSON.stringify(variant) : "[]";
      const sameVariant = variantItemInCart == variantItemRemove;

      return (sameProduct && sameVariant);
    })

    if(itemUpdate) {
      // Nếu số lượng không đủ in ra thông báo
      const quantity = parseInt(inputQuantity.value);
      const max = parseInt(inputQuantity.max);
      if(quantity > max) {
        const itemAlert = document.createElement("div");
        itemAlert.style.color = "red";
        itemAlert.style.fontSize = "12px";
        itemAlert.innerHTML = `Chỉ còn ${max} sản phẩm!`;
        box.appendChild(itemAlert);
      }
      
      // Tăng số lượng
      buttonPlus.addEventListener("click", () => {
        const quantity = parseInt(inputQuantity.value);
        const max = parseInt(inputQuantity.max);
        if(quantity < max) {
          itemUpdate.quantity = quantity + 1;
          localStorage.setItem("cart", JSON.stringify(cart));
          drawCart();
        }
      })

      // Giảm số lượng
      buttonMinus.addEventListener("click", () => {
        const quantity = parseInt(inputQuantity.value);
        const min = parseInt(inputQuantity.min);
        if(quantity > min) {
          itemUpdate.quantity = quantity - 1;
          localStorage.setItem("cart", JSON.stringify(cart));
          drawCart();
        }
      })
    }
  })
}
// Hết Cập nhật số lượng item trong giỏ hàng

// Vẽ giỏ hàng
const drawCart = () => {
  const cart = JSON.parse(localStorage.getItem("cart"));
  if(cart.length > 0) {
    fetch(`/cart/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cart)
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          localStorage.setItem("cart", JSON.stringify([]));
        }

        if(data.code == "success") {
          localStorage.setItem("cart", JSON.stringify(data.cart));

          let subTotal = 0;

          let htmlMiniCart = "";
          let htmlCartTable = "";
          let htmlCartSummary = "";

          data.cart.forEach(item => {
            const { detail } = item;
            let priceOld = 0;
            let priceNew = 0;
            let stock = 0;
            let htmlVariant = "";
            let htmlVariantSummary = "";

            if(item.variant) {
              // Tìm đúng biến thể khớp trong danh sách
              const variantMatched = detail.variants.find(variantItem => {
                return (
                  variantItem.attributeValue.every(attr => {
                    const selected = item.variant.find(v => v.attrId === attr.attrId);
                    return selected && selected.value === attr.value;
                  })
                );
              });
              priceOld = variantMatched.priceOld;
              priceNew = variantMatched.priceNew;
              stock = variantMatched.stock;

              detail.attributeList.forEach(attr => {
                const variant = item.variant.find(v => v.attrId === attr._id);
                htmlVariant += `
                  <span>
                    <b>${attr.name}:</b> ${variant.label}
                  </span>
                `;

                htmlVariantSummary += `
                  <p>${attr.name}: ${variant.label}</p>
                `;
              })
            } else {
              priceOld = detail.priceOld;
              priceNew = detail.priceNew;
              stock = detail.stock;
            }

            if(item.checked) {
              subTotal += priceNew * item.quantity;
            }

            htmlMiniCart += `
              <li
                cart-item
                product-id=${item.productId}
                ${item.variant ? `variant="${encodeURIComponent(JSON.stringify(item.variant))}"` : ''}
              >
                <a class="cart_img" href="/product/detail/${detail.slug}">
                  <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}">
                </a>
                <div class="cart_text">
                  <a class="cart_title" href="/product/detail/${detail.slug}">
                    ${detail.name}
                  </a>
                  <p>
                    ${priceNew.toLocaleString("vi-VN")}đ
                    <del>${priceOld.toLocaleString("vi-VN")}đ</del>
                  </p>
                  <span>
                    <b>Số lượng:</b> ${item.quantity}
                  </span>
                  ${htmlVariant}
                </div>
                <a class="del_icon" href="javascript:;" button-remove-item>
                  <i class="fal fa-times" aria-hidden="true"></i>
                </a>
              </li>
            `;

            htmlCartTable += `
              <tr
                cart-item
                product-id=${item.productId}
                ${item.variant ? `variant="${encodeURIComponent(JSON.stringify(item.variant))}"` : ''}
              >
                <td class="cart_page_checkbox">
                  <div class="form-check">
                    <input class="form-check-input" value="" type="checkbox" ${item.checked && "checked"} />
                  </div>
                </td>
                <td class="cart_page_img">
                  <div class="img">
                    <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}" />
                  </div>
                </td>
                <td class="cart_page_details">
                  <a class="title" href="/product/detail/${detail.slug}">${detail.name}</a>
                  <p>
                    ${priceNew.toLocaleString("vi-VN")}đ
                    <del>${priceOld.toLocaleString("vi-VN")}đ</del>
                  </p>
                  ${htmlVariant}
                </td>
                <td class="cart_page_price">
                  <h3>${priceNew.toLocaleString("vi-VN")}đ</h3>
                </td>
                <td class="cart_page_quantity">
                  <div class="details_qty_input">
                    <button class="minus">
                      <i class="fal fa-minus" aria-hidden="true"></i>
                    </button>
                    <input 
                      value="${item.quantity}" 
                      type="number" 
                      readonly="" 
                      min="1"
                      max="${stock}"
                    />
                    <button class="plus">
                      <i class="fal fa-plus" aria-hidden="true"></i>
                    </button>
                  </div>
                </td>
                <td class="cart_page_total">
                  <h3>${(priceNew * item.quantity).toLocaleString("vi-VN")}đ</h3>
                </td>
                <td class="cart_page_action">
                  <a href="javascript:;" button-remove-item>
                    <i class="fal fa-times" aria-hidden="true"></i> Xóa
                  </a>
                </td>
              </tr>
            `;

            if(item.checked) {
              htmlCartSummary += `
                <li>
                  <a class="img" href="/product/detail/${detail.slug}">
                    <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}">
                  </a>
                  <div class="text">
                    <a class="title" href="/product/detail/${detail.slug}">
                      ${detail.name}
                    </a>
                    <p>${priceNew.toLocaleString("vi-VN")}đ × ${item.quantity}</p>
                    ${htmlVariantSummary}
                  </div>
                </li>
              `;
            }
          })

          let discount = 0;
          let total = subTotal - discount;

          const ulMiniCart = miniCart.querySelector(".offcanvas-body ul");
          ulMiniCart.innerHTML = htmlMiniCart;

          const cartTable = document.querySelector("[cart-table]");
          if(cartTable) {
            cartTable.innerHTML = htmlCartTable;
          }

          const cartSummary = document.querySelector("[cart-summary]");
          if(cartSummary) {
            cartSummary.innerHTML = htmlCartSummary;
          }

          const listElementSubTotal = document.querySelectorAll("[sub-total]");
          listElementSubTotal.forEach(item => {
            item.innerHTML = subTotal.toLocaleString("vi-VN");
          })

          const elementDiscount = document.querySelector("[discount]");
          if(elementDiscount) {
            elementDiscount.innerHTML = discount.toLocaleString("vi-VN");
          }

          const elementTotal = document.querySelector("[total]");
          if(elementTotal) {
            elementTotal.innerHTML = total.toLocaleString("vi-VN");
          }

          eventRemoveItemInCart();
          eventQuantityItemInCart();
          eventCheckItemInCart();
        }
      })
  } else {
    const ulMiniCart = miniCart.querySelector(".offcanvas-body ul");
    ulMiniCart.innerHTML = "Giỏ hàng trống.";

    const cartTable = document.querySelector("[cart-table]");
    if(cartTable) {
      cartTable.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">
            Giỏ hàng trống.
          </td>
        </tr>
      `;
    }

    const cartSummary = document.querySelector("[cart-summary]");
    if(cartSummary) {
      cartSummary.innerHTML = "";
    }

    const listElementSubTotal = document.querySelectorAll("[sub-total]");
    listElementSubTotal.forEach(item => {
      item.innerHTML = 0;
    })
  }
}
// Hết Vẽ giỏ hàng

// Tạo mảng so sánh mới
const existCompareList = localStorage.getItem("compare");
if(!existCompareList) {
  localStorage.setItem("compare", JSON.stringify([]));
}
// Hết Tạo mảng so sánh mới

// mini-compare-quantity
const miniCompareQuantity = () => {
  const compareList = JSON.parse(localStorage.getItem("compare"));
  const miniCompareQuantity = document.querySelector("[mini-compare-quantity]");
  miniCompareQuantity.innerHTML = compareList.length;
}
miniCompareQuantity();
// End mini-compare-quantity

// shop_details_text
const shopDetailsText = document.querySelector(".shop_details_text");
if(shopDetailsText) {
  const elementStock = shopDetailsText.querySelector(".stock");
  const elementPriceNew = shopDetailsText.querySelector(".price-new");
  const elementPriceOld = shopDetailsText.querySelector(".price-old");
  const listElementLiVariant = shopDetailsText.querySelectorAll(".details_single_variant li");
  const inputQuantity = shopDetailsText.querySelector(".input-quantity");
  const buttonPlus = shopDetailsText.querySelector(".plus");
  const buttonMinus = shopDetailsText.querySelector(".minus");
  const buttonAddCart = shopDetailsText.querySelector("[button-add-cart]");

  const selected = {};
  let variantSelected = null; // biến thể đã chọn

  listElementLiVariant.forEach(item => {
    item.addEventListener("click", () => {
      const attributeId = item.getAttribute("attribute-id");
      const variant = item.getAttribute("variant");

      // Xóa class active cho item cũ
      item.closest("ul").querySelectorAll("li").forEach(li => li.classList.remove("active"));

      // Thêm class active cho thẻ li đã chọn
      item.classList.add("active");
      
      // Lưu lựa chọn
      selected[attributeId] = variant;

      // Kiểm tra xem đã chọn đủ thuộc tính chưa
      const selectedValues = Object.values(selected);
      if(selectedValues.length > 0) {
        // Lọc variant có đủ attributeValue trùng khớp
        const variantMatched = productVariants.find(variantItem => {
          return variantItem.attributeValue.every(attr => selected[attr.attrId] == attr.value)
        })

        if(variantMatched) {
          elementPriceNew.innerHTML = variantMatched.priceNew.toLocaleString("vi-VN") + "đ";
          elementPriceOld.innerHTML = variantMatched.priceOld.toLocaleString("vi-VN") + "đ";

          if(variantMatched.stock > 0) {
            elementStock.innerHTML = `Còn hàng (${variantMatched.stock})`;
            elementStock.classList.remove("out_stock");
            inputQuantity.value = 1;
            variantSelected = variantMatched;
          } else {
            elementStock.innerHTML = `Hết hàng`;
            elementStock.classList.add("out_stock");
            inputQuantity.value = 0;
            variantSelected = null;
          }

          // Gán lại số lượng tối đa được phép đặt
          inputQuantity.max = variantMatched.stock;
        }
      }
    })
  })

  // Tăng số lượng
  buttonPlus.addEventListener("click", () => {
    const quantity = parseInt(inputQuantity.value);
    const max = parseInt(inputQuantity.max);
    if(quantity < max) {
      inputQuantity.value = quantity + 1;
    }
  })

  // Giảm số lượng
  buttonMinus.addEventListener("click", () => {
    const quantity = parseInt(inputQuantity.value);
    const min = parseInt(inputQuantity.min);
    if(quantity > min) {
      inputQuantity.value = quantity - 1;
    }
  })

  // Thêm vào giỏ hàng
  buttonAddCart.addEventListener("click", () => {
    const productId = buttonAddCart.getAttribute("product-id");
    const quantity = parseInt(inputQuantity.value);
    if(productId && quantity > 0) {
      const dataItem = {
        productId: productId,
        quantity: quantity,
        checked: true
      };
      const cart = JSON.parse(localStorage.getItem("cart"));

      if(productVariants && productVariants.length > 0 && variantSelected) {
        dataItem.variant = variantSelected.attributeValue;

        // Tìm xem có sản phẩm trùng productId và trùng các attributeValue hay không
        const existItem = cart.find(item => {
          if(item.productId !== dataItem.productId) {
            return false;
          }

          // So sánh toàn bộ các thuộc tính trong variant
          const oldAttrs = item.variant;
          const newAttrs = dataItem.variant;

          // Số lượng thuộc tính phải trùng
          if(oldAttrs.length !== newAttrs.length) {
            return false;
          }

          // Kiểm tra từng attrId và value
          return oldAttrs.every(attr => {
            const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
            return match ? true : false;
          });
        })

        if(existItem) {
          existItem.quantity = dataItem.quantity;
          notyf.success("Đã cập nhật số lượng trong giỏ hàng!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Đã thêm vào giỏ hàng!");
        }
      } else {
        // Tìm xem có sản phẩm trùng productId hay không
        const existItem = cart.find(item => item.productId === dataItem.productId);

        if(existItem) {
          existItem.quantity = dataItem.quantity;
          notyf.success("Đã cập nhật số lượng trong giỏ hàng!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Đã thêm vào giỏ hàng!");
        }
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      miniCartQuantity();
      drawCart();
    }
  })

  // Thêm vào so sánh
  const buttonAddCompare = shopDetailsText.querySelector("[button-add-compare]");
  buttonAddCompare.addEventListener("click", () => {
    const productId = buttonAddCompare.getAttribute("product-id");
    if(productId) {
      const dataItem = {
        productId: productId
      };
      const compareList = JSON.parse(localStorage.getItem("compare"));

      if(compareList.length < 5) {
        if(productVariants && productVariants.length > 0 && variantSelected) {
          dataItem.variant = variantSelected.attributeValue;

          // Tìm xem có sản phẩm trùng productId và trùng các attributeValue hay không
          const existItem = compareList.find(item => {
            if(item.productId !== dataItem.productId) {
              return false;
            }

            // So sánh toàn bộ các thuộc tính trong variant
            const oldAttrs = item.variant;
            const newAttrs = dataItem.variant;

            // Số lượng thuộc tính phải trùng
            if(oldAttrs.length !== newAttrs.length) {
              return false;
            }

            // Kiểm tra từng attrId và value
            return oldAttrs.every(attr => {
              const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
              return match ? true : false;
            });
          })

          if(existItem) {
            notyf.success("Sản phẩm đã có trong so sánh!");
          } else {
            compareList.push(dataItem);
            notyf.success("Đã thêm vào so sánh!");
          }
        } else {
          // Tìm xem có sản phẩm trùng productId hay không
          const existItem = compareList.find(item => item.productId === dataItem.productId);

          if(existItem) {
            notyf.success("Sản phẩm đã có trong so sánh!");
          } else {
            compareList.push(dataItem);
            notyf.success("Đã thêm vào so sánh!");
          }
        }

        localStorage.setItem("compare", JSON.stringify(compareList));
        miniCompareQuantity();
      } else {
        notyf.error("Số lượng sản phẩm so sánh đã đủ!");
      }
    }
  })
}
// End shop_details_text

// Giỏ hàng
const miniCart = document.querySelector("[mini-cart]");
if(miniCart) {
  drawCart();
}
// Hết Giỏ hàng

// Input Check All
const inputCartCheckAll = document.querySelector("[input-cart-check-all]");
if(inputCartCheckAll) {
  inputCartCheckAll.addEventListener("change", () => {
    const checked = inputCartCheckAll.checked;
    const cart = JSON.parse(localStorage.getItem("cart"));
    cart.forEach(item => item.checked = checked);
    localStorage.setItem("cart", JSON.stringify(cart));
    drawCart();
  })
}
// End Input Check All

// Nút thêm vào giỏ hàng ở trang So sánh
const eventAddItemToCartInCompare = () => {
  const listButtonAdd = document.querySelectorAll("[button-add]");
  listButtonAdd.forEach(button => {
    button.addEventListener("click", () => {
      const index = button.getAttribute("button-add");
      const compareList = JSON.parse(localStorage.getItem("compare"));
      const compareItem = compareList[index];
      const dataItem = {
        productId: compareItem.productId,
        quantity: 1,
        checked: true
      };

      const cart = JSON.parse(localStorage.getItem("cart"));

      if(compareItem.variant) {
        dataItem.variant = compareItem.variant;

        // Tìm xem có sản phẩm trùng productId và trùng các attributeValue hay không
        const existItem = cart.find(item => {
          if(item.productId !== dataItem.productId) {
            return false;
          }

          // So sánh toàn bộ các thuộc tính trong variant
          const oldAttrs = item.variant;
          const newAttrs = dataItem.variant;

          // Số lượng thuộc tính phải trùng
          if(oldAttrs.length !== newAttrs.length) {
            return false;
          }

          // Kiểm tra từng attrId và value
          return oldAttrs.every(attr => {
            const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
            return match ? true : false;
          });
        })

        if(existItem) {
          notyf.success("Sản phẩm đã có trong giỏ hàng!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Đã thêm vào giỏ hàng!");
        }
      } else {
        // Tìm xem có sản phẩm trùng productId hay không
        const existItem = cart.find(item => item.productId === dataItem.productId);

        if(existItem) {
          notyf.success("Sản phẩm đã có trong giỏ hàng!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Đã thêm vào giỏ hàng!");
        }
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      miniCartQuantity();
      drawCart();
    })
  })
}
// Hết Nút thêm vào giỏ hàng ở trang So sánh

// Vẽ Vẽ trang so sánh
const drawComparePage = () => {
  const compareList = JSON.parse(localStorage.getItem("compare"));
  if(compareList.length > 0) {
    fetch(`/compare/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(compareList)
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          localStorage.setItem("compare", JSON.stringify([]));
        }

        if(data.code == "success") {
          localStorage.setItem("compare", JSON.stringify(data.compareList));

          let html1 = "";
          let html2 = "";
          let html3 = "";
          let html4 = "";
          let html5 = "";
          let html6 = "";

          data.compareList.forEach((item, index) => {
            const { detail } = item;
            let priceOld = 0;
            let priceNew = 0;
            let stock = 0;
            let htmlVariant = "";

            if(item.variant) {
              // Tìm đúng biến thể khớp trong danh sách
              const variantMatched = detail.variants.find(variantItem => {
                return (
                  variantItem.attributeValue.every(attr => {
                    const selected = item.variant.find(v => v.attrId === attr.attrId);
                    return selected && selected.value === attr.value;
                  })
                );
              });
              priceOld = variantMatched.priceOld;
              priceNew = variantMatched.priceNew;
              stock = variantMatched.stock;

              detail.attributeList.forEach(attr => {
                const variant = item.variant.find(v => v.attrId === attr._id);
                htmlVariant += `
                  <p>${attr.name}: ${variant.label}</p>
                `;
              })
            } else {
              priceOld = detail.priceOld;
              priceNew = detail.priceNew;
              stock = detail.stock;
            }

            html1 += `
              <td>
                <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}">
                <a class="title" href="/product/detail/${detail.slug}">${detail.name}</a>
              </td>
            `;

            html2 += `
              <td>
                ${detail.description}
              </td>
            `;

            html3 += `
              <td>
                <p>
                  ${priceNew.toLocaleString("vi-VN")}đ
                  <del>${priceOld.toLocaleString("vi-VN")}đ</del>
                </p>
              </td>
            `;

            html4 += `
              <td>
                ${htmlVariant}
              </td>
            `;

            html5 += `
              <td>
                <p class="rating">
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fal fa-star" aria-hidden="true"></i>
                </p>
              </td>
            `;

            html6 += `
              <td>
                ${
                  stock > 0 ? 
                  '<a class="common_btn" href="javascript:;" button-add="'+index+'">Thêm vào giỏ</a>' 
                  : 
                  '<div class="text-danger">Đã hết hàng</div>'
                }
                <a class="remove common_btn" href="#">
                  <i class="fal fa-trash" aria-hidden="true"></i>
                </a>
              </td>
            `;
          })

          const elementHtml1 = document.querySelector("[html-1]");
          elementHtml1.outerHTML = html1;

          const elementHtml2 = document.querySelector("[html-2]");
          elementHtml2.outerHTML = html2;

          const elementHtml3 = document.querySelector("[html-3]");
          elementHtml3.outerHTML = html3;

          const elementHtml4 = document.querySelector("[html-4]");
          elementHtml4.outerHTML = html4;

          const elementHtml5 = document.querySelector("[html-5]");
          elementHtml5.outerHTML = html5;

          const elementHtml6 = document.querySelector("[html-6]");
          elementHtml6.outerHTML = html6;

          eventAddItemToCartInCompare();
        }
      })
  }
}
// Hết Vẽ trang so sánh

// Trang so sánh
const comparePage = document.querySelector(".compare_page");
if(comparePage) {
  drawComparePage();
}
// Hết Trang so sánh