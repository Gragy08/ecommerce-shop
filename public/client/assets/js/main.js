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
        quantity: quantity
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
    }
  })
}
// End shop_details_text

// Tạo giỏ hàng mới
const existCart = localStorage.getItem("cart");
if(!existCart) {
  localStorage.setItem("cart", JSON.stringify([]));
}
// Hết Tạo giỏ hàng mới