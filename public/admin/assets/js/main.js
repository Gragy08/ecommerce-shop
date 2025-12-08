// Initial TinyMCE
const initialTinyMCE = () => {
  tinymce.init({
    selector: '[textarea-mce]',
    plugins: [
      'accordion', 'anchor', 'autolink', 'charmap', 'codesample', 'emoticons', 'link', 'autoresize', 'lists', 'media', 'searchreplace', 'table', 'visualblocks', 'wordcount', 'image'
    ],
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat | image',
    init_instance_callback: (editor) => {
      editor.on("OpenWindow", () => {
        const title = document.querySelector(".tox .tox-dialog__title")?.innerHTML;
        if(title == "Insert/Edit Media" || title == "Insert/Edit Image") {
          const inputSource = document.querySelector(`.tox input.tox-textfield[type="url"]`);
          inputSource.value = domainCDN;
        }
      })
    }
  });
}
initialTinyMCE();
// End Initial TinyMCE

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

// articleCreateCategoryForm
const articleCreateCategoryForm = document.querySelector("#articleCreateCategoryForm");
if(articleCreateCategoryForm) {
  const validator = new JustValidate('#articleCreateCategoryForm');

  validator
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên danh mục!',
      },
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!',
      },
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      // const description = event.target.description.value;
      const description = tinymce.get("description").getContent();

      // Tạo formData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);

      fetch(`/${pathAdmin}/article/category/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            location.reload();
          }
        })
    });
}
// End articleCreateCategoryForm

// articleEditCategoryForm
const articleEditCategoryForm = document.querySelector("#articleEditCategoryForm");
if(articleEditCategoryForm) {
  const validator = new JustValidate('#articleEditCategoryForm');

  validator
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên danh mục!',
      },
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();

      // Tạo formData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);

      fetch(`/${pathAdmin}/article/category/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    });
}
// End articleEditCategoryForm

// btn-generate-slug
const buttonGenerateSlug = document.querySelector("[btn-generate-slug]");
if(buttonGenerateSlug) {
  buttonGenerateSlug.addEventListener("click", () => {
    const modalName = buttonGenerateSlug.getAttribute("btn-generate-slug");
    const from = buttonGenerateSlug.getAttribute("from");
    const to = buttonGenerateSlug.getAttribute("to");
    const string = document.querySelector(`[name="${from}"]`).value;
    
    const dataFinal = {
      string: string,
      modalName: modalName
    };

    fetch(`/${pathAdmin}/helper/generate-slug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dataFinal)
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          notyf.error(data.message);
        }

        if(data.code == "success") {
          document.querySelector(`[name="${to}"]`).value = data.slug;
        }
      })
  })
}
// End btn-generate-slug

// button-api
const listButtonApi = document.querySelectorAll("[button-api]");
if(listButtonApi.length > 0) {
  listButtonApi.forEach(button => {
    button.addEventListener("click", () => {
      const method = button.getAttribute("data-method");
      const api = button.getAttribute("data-api");

      fetch(api, {
        method: method || "GET"
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            location.reload();
          }
        })
    })
  })
}
// End button-api

// form-search
const formSearch = document.querySelector("[form-search]");
if(formSearch) {
  const url = new URL(window.location.href);

  formSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = event.target.keyword.value;
    if(value) {
      url.searchParams.set("keyword", value);
    } else {
      url.searchParams.delete("keyword");
    }
    window.location.href = url.href;
  })

  // Hiển thị giá trị mặc định
  const valueCurrent = url.searchParams.get("keyword");
  if(valueCurrent) {
    formSearch.keyword.value = valueCurrent;
  }
}
// End form-search

// pagination
const pagination = document.querySelector("[pagination]");
if(pagination) {
  const url = new URL(window.location.href);

  pagination.addEventListener("change", () => {
    const value = pagination.value;
    if(value) {
      url.searchParams.set("page", value);
    } else {
      url.searchParams.delete("page");
    }
    window.location.href = url.href;
  })

  // Hiển thị giá trị mặc định
  const valueCurrent = url.searchParams.get("page");
  if(valueCurrent) {
    pagination.value = valueCurrent;
  }
}
// End pagination

// button-copy
const listButtonCopy = document.querySelectorAll("[button-copy]");
if(listButtonCopy.length > 0) {
  listButtonCopy.forEach(button => {
    button.addEventListener("click", () => {
      const content = button.getAttribute("data-content");
      window.navigator.clipboard.writeText(content);
      notyf.success("Đã copy!");
    })
  })
}
// End button-copy

// Modal Preview File
const modalPreviewFile = document.querySelector("#modalPreviewFile");
if(modalPreviewFile) {
  const innerPreview = modalPreviewFile.querySelector(".inner-preview");

  // Sự kiện click button
  let buttonClicked = null;

  const listButtonPreviewFile = document.querySelectorAll("[button-preview-file]");
  listButtonPreviewFile.forEach(button => {
    button.addEventListener("click", () => {
      buttonClicked = button;
    })
  })

  // Sự kiện đóng modal
  modalPreviewFile.addEventListener('hidden.bs.modal', event => {
    buttonClicked = null;
    innerPreview.innerHTML = "";
  })

  // Sự kiện mở modal
  modalPreviewFile.addEventListener('shown.bs.modal', event => {
    const file = buttonClicked.getAttribute("data-file");
    const mimetype = buttonClicked.getAttribute("data-mimetype");

    // Nếu là file ảnh
    if(mimetype.includes("image")) {
      innerPreview.innerHTML = `
        <img src="${file}" width="100%" />
      `;
    }
    else if(mimetype.includes("audio")) {
      innerPreview.innerHTML = `
        <audio controls>
          <source src="${file}" />
        </audio>
      `;
    }
    else if(mimetype.includes("video")) {
      innerPreview.innerHTML = `
        <video controls width="100%">
          <source src="${file}" />
        </video>
      `;
    }
    else if(mimetype.includes("application/pdf")) {
      innerPreview.innerHTML = `
        <iframe src="${file}" width="100%" height="600px"></iframe>
      `;
    }
  })
}
// End Modal Preview File

// Modal Change File Name
const modalChangeFileName = document.querySelector("#modalChangeFileName");
if(modalChangeFileName) {
  const form = modalChangeFileName.querySelector("form");

  let buttonClicked = null;

  const listButtonChangeFileName = document.querySelectorAll("[button-change-file-name]");
  listButtonChangeFileName.forEach(button => {
    button.addEventListener("click", () => {
      buttonClicked = button;
    })
  })

  // Sự kiện đóng modal
  modalChangeFileName.addEventListener('hidden.bs.modal', event => {
    buttonClicked = null;
    form.fileId.value = "";
    form.fileName.value = "";
  })

  // Sự kiện mở modal
  modalChangeFileName.addEventListener('shown.bs.modal', event => {
    const fileId = buttonClicked.getAttribute("data-file-id");
    const fileName = buttonClicked.getAttribute("data-file-name");

    form.fileId.value = fileId;
    form.fileName.value = fileName;
  })

  // Sự kiện submit form
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fileId = form.fileId.value;
    const fileName = form.fileName.value;

    if(fileId && fileName) {
      const formData = new FormData();
      formData.append("fileName", fileName);

      fetch(`/${pathAdmin}/file-manager/change-file-name/${fileId}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            location.reload();
          }
        })
    }
  })
}
// End Modal Change File Name

// Button Delete File
const listButtonDeleteFile = document.querySelectorAll("[button-delete-file]");
if(listButtonDeleteFile.length > 0) {
  listButtonDeleteFile.forEach(button => {
    button.addEventListener("click", () => {
      const fileId = button.getAttribute("data-file-id");
      const fileName = button.getAttribute("data-file-name");

      const isConfirm = confirm(`Bạn có chắc muốn xóa file: ${fileName}`);
      if(isConfirm) {
        fetch(`/${pathAdmin}/file-manager/delete-file/${fileId}`, {
          method: "DELETE"
        })
          .then(res => res.json())
          .then(data => {
            if(data.code == "error") {
              notyf.error(data.message);
            }

            if(data.code == "success") {
              drawNotify(data.code, data.message);
              location.reload();
            }
          })
      }
    })
  })
}
// End Button Delete File

// Form Create Folder
const formCreateFolder = document.querySelector("[form-create-folder]");
if(formCreateFolder) {
  formCreateFolder.addEventListener("submit", (event) => {
    event.preventDefault();
    const folderName = event.target.folderName.value;
    if(!folderName) {
      notyf.error("Vui lòng nhập tên folder");
      return;
    }

    // Tạo formData
    const formData = new FormData();
    formData.append("folderName", folderName);

    const urlParams = new URLSearchParams(window.location.search);
    const folderPath = urlParams.get("folderPath");
    if(folderPath) {
      formData.append("folderPath", folderPath);
    }

    fetch(`/${pathAdmin}/file-manager/folder/create`, {
      method: "POST",
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          notyf.error(data.message);
        }

        if(data.code == "success") {
          drawNotify(data.code, data.message);
          location.reload();
        }
      })
  })
}
// End Form Create Folder

// Button To Folder
const listButtonToFolder = document.querySelectorAll("[button-to-folder]");
if(listButtonToFolder.length > 0) {
  const url = new URL(window.location.href);

  listButtonToFolder.forEach(button => {
    button.addEventListener("click", () => {
      let folderPath = button.getAttribute("data-folder-path");
      if(folderPath) {
        const urlParams = new URLSearchParams(window.location.search);
        const folderPathCurrent = urlParams.get("folderPath");
        if(folderPathCurrent) {
          folderPath = `${folderPathCurrent}/${folderPath}`;
        }
        url.searchParams.set("folderPath", folderPath);
      } else {
        url.searchParams.delete("folderPath");
      }
      window.location.href = url.href;
    })
  })
}
// End Button To Folder

// Breadcrumb Folder
const breadcumbFolder = document.querySelector("[breadcumb-folder]");
if(breadcumbFolder) {
  const urlParams = new URLSearchParams(window.location.search);
  const folderPath = urlParams.get("folderPath") || "";
  const listFolder = folderPath.split("/") || [];

  let htmls = `
    <li class="list-group-item bg-white">
      <a href="/${pathAdmin}/file-manager">
        <i class="la la-angle-double-right text-info me-2"></i>
        Media
      </a>
    </li>
  `;

  let path = "";
  listFolder.forEach((item, index) => {
    path += (index > 0 ? "/" : "") + listFolder[index];

    htmls += `
      <li class="list-group-item bg-white">
        <a href="/${pathAdmin}/file-manager?folderPath=${path}">
          <i class="la la-angle-double-right text-info me-2"></i>
          ${item}
        </a>
      </li>
    `;
  });
  breadcumbFolder.innerHTML = htmls;
}
// End Breadcrumb Folder

// Button Delete Folder
const listButtonDeleteFolder = document.querySelectorAll("[button-delete-folder]");
if(listButtonDeleteFolder.length > 0) {
  listButtonDeleteFolder.forEach(button => {
    button.addEventListener("click", () => {
      const urlParams = new URLSearchParams(window.location.search);
      const folderPath = urlParams.get("folderPath") || "";
      const folderName = button.getAttribute("data-folder-name");
      let folderFinal = "/media";
      if(folderPath) {
        folderFinal += `/${folderPath}`;
      }
      if(folderName) {
        folderFinal += `/${folderName}`;
      }
      const isConfirm = confirm(`Bạn có chắc muốn xóa folder: ${folderName}? Hành động này sẽ không thể khôi phục.`);
      if(isConfirm) {
        fetch(`/${pathAdmin}/file-manager/folder/delete?folderPath=${folderFinal}`, {
          method: "DELETE"
        })
          .then(res => res.json())
          .then(data => {
            if(data.code == "error") {
              notyf.error(data.message);
            }

            if(data.code == "success") {
              drawNotify("success", data.message);
              location.reload();
            }
          })
      }
    })
  })
}
// End Button Delete Folder

// Form Group File
const formGroupFile = document.querySelector("[form-group-file]");
if(formGroupFile) {
  const inputFile = formGroupFile.querySelector("[input-file]");
  const previewFile = formGroupFile.querySelector("[preview-file]");

  inputFile.addEventListener("input", () => {
    const value = inputFile.value;
    previewFile.querySelector("img").src = `${domainCDN}${value}`;
  })

  // Hiển thị mặc định
  if(inputFile.value) {
    const value = inputFile.value;
    previewFile.querySelector("img").src = `${domainCDN}${value}`;
  }
}
// End Form Group File

// Checkbox List
const getCheckboxList = (name) => {
  const checkboxList = document.querySelector(`[checkbox-list="${name}"]`);
  const inputList = checkboxList.querySelectorAll(`input[type="checkbox"]:checked`);
  const idList = [];
  inputList.forEach(input => {
    const id = input.value;
    if(id) {
      idList.push(id);
    }
  })
  return idList;
}
// End Checkbox List

// Get Multi File
const getMultiFile = (name) => {
  const boxMultiFile = document.querySelector(`[multi-file="${name}"]`);
  const listImage = boxMultiFile.querySelectorAll(`img[src-relative]`);
  const listLink = [];
  listImage.forEach(image => {
    const link = image.getAttribute("src-relative");
    if(link) {
      listLink.push(link);
    }
  })
  return listLink;
}
// End Get Multi File

// Option List
const getOptionList = (name) => {
  const optionList = document.querySelectorAll(`[box-option="${name}"] .option-list .option-item`);
  const dataFinal = [];

  optionList.forEach(item => {
    const label = item.querySelector(".option-label").value;
    const value = item.querySelector(".option-value").value;
    if(label && value) {
      dataFinal.push({
        label: label,
        value: value
      });
    }
  })
  
  return dataFinal;
}
// End Option List

// Article Create Form
const articleCreateForm = document.querySelector("#articleCreateForm");
if(articleCreateForm) {
  const validation = new JustValidate('#articleCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên bài viết!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const category = getCheckboxList("category");
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("category", JSON.stringify(category));
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);
      formData.append("content", content);
      
      fetch(`/${pathAdmin}/article/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Article Create Form

// Article Edit Form
const articleEditForm = document.querySelector("#articleEditForm");
if(articleEditForm) {
  const validation = new JustValidate('#articleEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên bài viết!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const category = getCheckboxList("category");
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("category", JSON.stringify(category));
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);
      formData.append("content", content);
      
      fetch(`/${pathAdmin}/article/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Article Edit Form

// Role Create Form
const roleCreateForm = document.querySelector("#roleCreateForm");
if(roleCreateForm) {
  const validation = new JustValidate('#roleCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên nhóm quyền!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const description = event.target.description.value;
      const permissions = getCheckboxList("permissions");
      const status = event.target.status.value;

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("permissions", JSON.stringify(permissions));
      formData.append("status", status);
      
      fetch(`/${pathAdmin}/role/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Role Create Form

// Role Edit Form
const roleEditForm = document.querySelector("#roleEditForm");
if(roleEditForm) {
  const validation = new JustValidate('#roleEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên nhóm quyền!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const description = event.target.description.value;
      const permissions = getCheckboxList("permissions");
      const status = event.target.status.value;

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("permissions", JSON.stringify(permissions));
      formData.append("status", status);
      
      fetch(`/${pathAdmin}/role/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Role Edit Form

// Account Admin Create Form
const accountAdminCreateForm = document.querySelector("#accountAdminCreateForm");
if(accountAdminCreateForm) {
  const validation = new JustValidate('#accountAdminCreateForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập họ tên!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Họ tên phải có ít nhất 5 ký tự!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Họ tên không được vượt quá 50 ký tự!',
      },
    ])
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email của bạn!',
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mật khẩu!',
      },
      {
        validator: (value) => value.length >= 8,
        errorMessage: 'Mật khẩu phải chứa ít nhất 8 ký tự!',
      },
      {
        validator: (value) => /[A-Z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái in hoa!',
      },
      {
        validator: (value) => /[a-z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái thường!',
      },
      {
        validator: (value) => /\d/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ số!',
      },
      {
        validator: (value) => /[@$!%*?&]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt!',
      },
    ])
    .onSuccess((event) => {
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const password = event.target.password.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const roles = getCheckboxList("roles");

      // Tạo FormData
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("roles", JSON.stringify(roles));
      
      fetch(`/${pathAdmin}/account-admin/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Account Admin Create Form

// Account Admin Edit Form
const accountAdminEditForm = document.querySelector("#accountAdminEditForm");
if(accountAdminEditForm) {
  const validation = new JustValidate('#accountAdminEditForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập họ tên!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Họ tên phải có ít nhất 5 ký tự!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Họ tên không được vượt quá 50 ký tự!',
      },
    ])
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email của bạn!',
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const roles = getCheckboxList("roles");

      // Tạo FormData
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("roles", JSON.stringify(roles));
      
      fetch(`/${pathAdmin}/account-admin/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Account Admin Edit Form

// Account Admin Change Password Form
const accountAdminChangePasswordForm = document.querySelector("#accountAdminChangePasswordForm");
if(accountAdminChangePasswordForm) {
  const validation = new JustValidate('#accountAdminChangePasswordForm');

  validation
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mật khẩu!',
      },
      {
        validator: (value) => value.length >= 8,
        errorMessage: 'Mật khẩu phải chứa ít nhất 8 ký tự!',
      },
      {
        validator: (value) => /[A-Z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái in hoa!',
      },
      {
        validator: (value) => /[a-z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái thường!',
      },
      {
        validator: (value) => /\d/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ số!',
      },
      {
        validator: (value) => /[@$!%*?&]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const password = event.target.password.value;

      // Tạo FormData
      const formData = new FormData();
      formData.append("password", password);
      
      fetch(`/${pathAdmin}/account-admin/change-password/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Account Admin Change Password Form

// Account Login Form
const accountLoginForm = document.querySelector("#accountLoginForm");
if(accountLoginForm) {
  const validation = new JustValidate('#accountLoginForm');

  validation
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email của bạn!',
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mật khẩu!',
      }
    ])
    .onSuccess((event) => {
      const email = event.target.email.value;
      const password = event.target.password.value;
      const rememberPassword = event.target.rememberPassword.checked;

      // Tạo FormData
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      formData.append("rememberPassword", rememberPassword);
      
      fetch(`/${pathAdmin}/account/login`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.href = `/${pathAdmin}/dashboard`;
          }
        })
    })
  ;
}
// End Account Login Form

// // Filter Start Date
// const filterStartDate = document.querySelector("[filter-start-date]");
// if(filterStartDate) {
//   const url = new URL(window.location.href);

//   // Lắng nghe thay đổi lựa chọn
//   filterStartDate.addEventListener("change", () => {
//     const value = filterStartDate.value;
//     if(value) {
//       url.searchParams.set("startDate", value);
//     } else {
//       url.searchParams.delete("startDate");
//     }

//     window.location.href = url.href;
//   })

//   // Hiển thị lựa chọn mặc định
//   const valueCurrent = url.searchParams.get("startDate");
//   if(valueCurrent) {
//     filterStartDate.value = valueCurrent;
//   }
// }
// // End Filter Start Date

// // Filter End Date
// const filterEndDate = document.querySelector("[filter-end-date]");
// if(filterEndDate) {
//   const url = new URL(window.location.href);

//   // Lắng nghe thay đổi lựa chọn
//   filterEndDate.addEventListener("change", () => {
//     const value = filterEndDate.value;
//     if(value) {
//       url.searchParams.set("endDate", value);
//     } else {
//       url.searchParams.delete("endDate");
//     }

//     window.location.href = url.href;
//   })

//   // Hiển thị lựa chọn mặc định
//   const valueCurrent = url.searchParams.get("endDate");
//   if(valueCurrent) {
//     filterEndDate.value = valueCurrent;
//   }
// }
// // End Filter End Date

// // Filter Reset
// const filterReset = document.querySelector("[filter-reset]");
// if(filterReset) {
//   const url = new URL(window.location.href);

//   filterReset.addEventListener("click", () => {
//     url.search = "";
//     window.location.href = url.href;
//   })
// }
// // End Filter Reset

// Product Create Category Form
const productCreateCategoryForm = document.querySelector("#productCreateCategoryForm");
if(productCreateCategoryForm) {
  const validation = new JustValidate('#productCreateCategoryForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên danh mục!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);
      
      fetch(`/${pathAdmin}/product/category/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Product Create Category Form

// productEditCategoryForm
const productEditCategoryForm = document.querySelector("#productEditCategoryForm");
if(productEditCategoryForm) {
  const validator = new JustValidate('#productEditCategoryForm');

  validator
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên danh mục!',
      },
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();

      // Tạo formData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);

      fetch(`/${pathAdmin}/product/category/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    });
}
// End productEditCategoryForm

// Product Create Form
const productCreateForm = document.querySelector("#productCreateForm");
if(productCreateForm) {
  const validation = new JustValidate('#productCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên sản phẩm!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const category = getCheckboxList("category");
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();
      const images = getMultiFile("images");
      const priceOld = event.target.priceOld.value;
      const priceNew = event.target.priceNew.value;
      const priceWholeSale = event.target.priceWholeSale.value;
      const attributes = getCheckboxList("attributes");
      const stock = event.target.stock.value;

      // variants
      const variants = [];
      const listTr = document.querySelectorAll("[variant-table] tbody tr");
      listTr.forEach(tr => {
        const status = tr.querySelector("input.form-check-input").checked;
        let attributeValue = JSON.parse(tr.querySelector("[attribute-value]").value);

        // Cập nhật lại Label nếu người dùng có sửa input (Color)
        const labelInputs = tr.querySelectorAll(`input[name="variant_label_edit"]`);
        labelInputs.forEach(input => {
          const index = parseInt(input.getAttribute("data-attr-index"));
          const newLabel = input.value;
          // Cập nhật label tại vị trí index trong attributeValue array
          if(attributeValue[index] && newLabel) {
            attributeValue[index].label = newLabel;
          }
        });

        let priceWholeSale = tr.querySelector("[price-whole-sale]").value;
        if(priceWholeSale) {
          priceWholeSale = parseInt(priceWholeSale);
        } else {
          priceWholeSale = 0;
        }
        let priceOld = tr.querySelector("[price-old]").value;
        if(priceOld) {
          priceOld = parseInt(priceOld);
        }
        let priceNew = tr.querySelector("[price-new]").value;
        if(priceNew) {
          priceNew = parseInt(priceNew);
        } else {
          priceNew = priceOld;
        }
        let stock = tr.querySelector("[stock]").value;
        if(stock) {
          stock = parseInt(stock);
        } else {
          stock = 0;
        }

        variants.push({
          status: status,
          attributeValue: attributeValue,
          priceWholeSale: priceWholeSale,
          priceOld: priceOld,
          priceNew: priceNew,
          stock: stock
        });
      })
      // End variants

      // tags
      const selectTag = document.querySelector(`select[name="tags"]`);
      const tags = Array.from(selectTag.selectedOptions).map(option => option.value);
      // End tags

      // boughtTogether
      const selectBoughtTogether = document.querySelector(`select[name="boughtTogether"]`);
      const boughtTogether = Array.from(selectBoughtTogether.selectedOptions).map(option => option.value);
      // End boughtTogether

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("position", position);
      formData.append("status", status);
      formData.append("category", JSON.stringify(category));
      formData.append("description", description);
      formData.append("content", content);
      formData.append("images", JSON.stringify(images));
      formData.append("priceWholeSale", priceWholeSale);
      formData.append("priceOld", priceOld);
      formData.append("priceNew", priceNew);
      formData.append("stock", stock);
      formData.append("attributes", JSON.stringify(attributes));
      formData.append("variants", JSON.stringify(variants));
      formData.append("tags", JSON.stringify(tags));
      formData.append("boughtTogether", JSON.stringify(boughtTogether));

      console.log(variants);
      
      fetch(`/${pathAdmin}/product/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Product Create Form

// Product Edit Form
const productEditForm = document.querySelector("#productEditForm");
if(productEditForm) {
  const validation = new JustValidate('#productEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên sản phẩm!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập đường dẫn!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const category = getCheckboxList("category");
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();
      const images = getMultiFile("images");
      const priceWholeSale = event.target.priceWholeSale.value;
      const priceOld = event.target.priceOld.value;
      const priceNew = event.target.priceNew.value;
      const stock = event.target.stock.value;
      const attributes = getCheckboxList("attributes");

      // variants
      const variants = [];
      const listTr = document.querySelectorAll("[variant-table] tbody tr");
      listTr.forEach(tr => {
        const status = tr.querySelector("input.form-check-input").checked;
        const attributeValue = JSON.parse(tr.querySelector("[attribute-value]").value);
        let priceWholeSale = tr.querySelector("[price-whole-sale]").value;
        if(priceWholeSale) {
          priceWholeSale = parseInt(priceWholeSale);
        } else {
          priceWholeSale = 0;
        }
        let priceOld = tr.querySelector("[price-old]").value;
        if(priceOld) {
          priceOld = parseInt(priceOld);
        }
        let priceNew = tr.querySelector("[price-new]").value;
        if(priceNew) {
          priceNew = parseInt(priceNew);
        } else {
          priceNew = priceOld;
        }
        let stock = tr.querySelector("[stock]").value;
        if(stock) {
          stock = parseInt(stock);
        } else {
          stock = 0;
        }
        variants.push({
          status: status,
          attributeValue: attributeValue,
          priceWholeSale: priceWholeSale,
          priceOld: priceOld,
          priceNew: priceNew,
          stock: stock,
        });
      })
      // End variants

      // tags
      const selectTag = document.querySelector(`select[name="tags"]`);
      const tags = Array.from(selectTag.selectedOptions).map(option => option.value);
      // End tags

      // boughtTogether
      const selectBoughtTogether = document.querySelector(`select[name="boughtTogether"]`);
      const boughtTogether = Array.from(selectBoughtTogether.selectedOptions).map(option => option.value);
      // End boughtTogether

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("position", position);
      formData.append("status", status);
      formData.append("category", JSON.stringify(category));
      formData.append("description", description);
      formData.append("content", content);
      formData.append("images", JSON.stringify(images));
      formData.append("priceWholeSale", priceWholeSale);
      formData.append("priceOld", priceOld);
      formData.append("priceNew", priceNew);
      formData.append("stock", stock);
      formData.append("attributes", JSON.stringify(attributes));
      formData.append("variants", JSON.stringify(variants));
      formData.append("tags", JSON.stringify(tags));
      formData.append("boughtTogether", JSON.stringify(boughtTogether));
      
      fetch(`/${pathAdmin}/product/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Product Edit Form

// Checkbox Multi
const listCheckboxInput = document.querySelectorAll(".checkbox-input");
if(listCheckboxInput.length > 0) {
  const inputCheckboxAll = document.querySelector(".checkbox-all");

  inputCheckboxAll.addEventListener("change", () => {
    listCheckboxInput.forEach(input => {
      input.checked = inputCheckboxAll.checked;
    })
  })

  listCheckboxInput.forEach(input => {
    input.addEventListener("change", () => {
      const listCheckboxInputChecked = document.querySelectorAll(".checkbox-input:checked");
      if(listCheckboxInputChecked.length == listCheckboxInput.length) {
        inputCheckboxAll.checked = true;
      } else {
        inputCheckboxAll.checked = false;
      }
    })
  })
}
// End Checkbox Multi

// Button Copy Multi
const buttonCopyMulti = document.querySelector("[button-copy-multi]");
if(buttonCopyMulti) {
  buttonCopyMulti.addEventListener("click", () => {
    const listCheckboxInputChecked = document.querySelectorAll(".checkbox-input:checked");
    const listLink = [];
    listCheckboxInputChecked.forEach(input => {
      listLink.push(input.value);
    })
    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(listLink));
    notyf.success("Đã copy!");
  })
}
// End Button Copy Multi

// Button Paste
const listButtonPaste = document.querySelectorAll("[button-paste]");
if(listButtonPaste) {
  listButtonPaste.forEach(buttonPaste => {
    // Lấy phần tử chứa danh sách hình ảnh, 
    // dùng closest để tìm phần tử cha gần nhất có class là form-multi-file,
    // rồi từ đó tìm đến inner-list-image
    // Làm như vậy để hỗ trợ nhiều form-multi-file trên cùng một trang
    const elementListImage = buttonPaste.closest(".form-multi-file").querySelector(".inner-list-image");

    buttonPaste.addEventListener("click", async () => {
      const listLinkJson = await navigator.clipboard.readText();
      const listLink = JSON.parse(listLinkJson);
      for (const link of listLink) {
        // Thêm vào danh sách hình ảnh, insertAdjacentHTML để không bị mất sự kiện, beforeend để thêm vào cuối
        elementListImage.insertAdjacentHTML("beforeend", `
          <div class="inner-image">
            <img src="${domainCDN}${link}" alt="" src-relative="${link}">
            <span class="inner-remove">x</span>
          </div>
        `);
        // Gửi thuộc tính src-relative lên BE để dễ dàng lưu trữ
      }
    })

    // Khởi tạo sortable, sắp xếp lại hình ảnh khi kéo thả
    new Sortable(elementListImage, {
      animation: 150
    });
  })
}
// End Button Paste

// Button Remove Image
const listElementListImage = document.querySelectorAll(".form-multi-file .inner-list-image");
if(listElementListImage.length > 0) {
  listElementListImage.forEach(elementListImage => {
    elementListImage.addEventListener("click", (event) => {
      // hàm closet tìm phần tử cha gần nhất có class là inner-remove
      if(event.target.closest(".inner-remove")) {
        // Lấy phần tử cha của nút xóa và xóa nó
        const parentItem = event.target.closest(".inner-image");
        if(parentItem) {
          parentItem.remove();
        }
      }
    })
  })
}
// End Button Remove Image

// box-option
const boxOption = document.querySelector("[box-option]");
if(boxOption) {
  const optionList = boxOption.querySelector(".option-list");
  const optionCreate = boxOption.querySelector(".option-create");

  // Tạo option
  optionCreate.addEventListener("click", () => {
    const newItem = `
      <div class="option-item">
        <span class="btn btn-secondary option-move">
          <i class="fa-solid fa-up-down-left-right"></i>
        </span>
        <input class="form-control option-label" type="text" placeholder="Nhãn">
        <input class="form-control option-value" type="text" placeholder="Giá trị">
        <span class="btn btn-danger option-remove">Xóa</span>
      </div>
    `;
    optionList.insertAdjacentHTML("beforeend", newItem);
  })

  // Xóa option
  optionList.addEventListener("click", (event) => {
    if(event.target.closest(".option-remove")) {
      const parentItem = event.target.closest(".option-item");
      if(parentItem) {
        parentItem.remove();
      }
    }
  })

  // Sắp xếp
  new Sortable(optionList, {
    animation: 150,
    handle: '.option-move',
  });
}
// End box-option

// Product Create Attribute Form
const productCreateAttributeForm = document.querySelector("#productCreateAttributeForm");
if(productCreateAttributeForm) {
  const validation = new JustValidate('#productCreateAttributeForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên thuộc tính!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const type = event.target.type.value;
      const options = getOptionList("options");

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("type", type);
      formData.append("options", JSON.stringify(options));
      
      fetch(`/${pathAdmin}/product/attribute/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Product Create Attribute Form

// Product Edit Attribute Form
const productEditAttributeForm = document.querySelector("#productEditAttributeForm");
if(productEditAttributeForm) {
  const validation = new JustValidate('#productEditAttributeForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên thuộc tính!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const type = event.target.type.value;
      const options = getOptionList("options");

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("type", type);
      formData.append("options", JSON.stringify(options));
      
      fetch(`/${pathAdmin}/product/attribute/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Product Edit Attribute Form

// button-render-variant
const generateVariants = (attributes) => {
  // Bước 1: Lấy ra danh sách các lựa chọn (options) cho từng thuộc tính
  const optionList = attributes.map((attribute, attrIdx) =>
    attribute.options.map(option => ({
      attrId: attribute._id,
      attrType: attribute.type,
      attrName: attribute.name,
      label: option.label,
      value: option.value,
      index: attrIdx, // Thêm index để theo dõi vị trí thuộc tính
    }))
  )

  // Bước 2: Tạo ra tổ hợp các biến thể
  const variantList = optionList.reduce((a, b) => a.flatMap(x => b.map(y => [...x, y])), [[]]);

  return variantList;
}

const buttonRenderVariant = document.querySelector("[button-render-variant]");
if(buttonRenderVariant) {
  buttonRenderVariant.addEventListener("click", () => {
    const attr = buttonRenderVariant.getAttribute("button-render-variant");
    const idList = getCheckboxList(attr);
    const attributeListChecked = attributeList.filter(item => idList.includes(item._id));
    const variantList = generateVariants(attributeListChecked);
    // console.log(variantList);

    // Lấy ra bảng
    const variantTable = document.querySelector("[variant-table]");

    // Hiển thị tiêu đề cột
    const variantHead = variantTable.querySelector("thead tr");
    let variantHeadHTML = "";
    variantHeadHTML += `
      <th scope="col">Trạng thái</th>
    `;
    attributeListChecked.forEach(item => {
      variantHeadHTML += `
        <th scope="col">${item.name}</th>
      `;
    })
    variantHeadHTML += `
      <th scope="col">Giá kênh sĩ</th>
      <th scope="col">Giá kênh lẻ (cũ)</th>
      <th scope="col">Giá kênh lẻ (mới)</th>
      <th scope="col">Còn lại</th>
    `;
    variantHead.innerHTML = variantHeadHTML;

    // Hiển thị các hàng
    const variantBody = variantTable.querySelector("tbody");
    const priceWholeSale = document.querySelector(`[name="priceWholeSale"]`).value;
    const priceOld = document.querySelector(`[name="priceOld"]`).value;
    const priceNew = document.querySelector(`[name="priceNew"]`).value;
    let variantBodyHTML = "";
    variantList.forEach(variant => {
      const variantJSON = JSON.stringify(variant).replaceAll(`"`, `&quot;`);
      let tr = "<tr>";
      tr += `
        <td>
          <div class="form-check form-switch form-switch-success">
            <input class="form-check-input" type="checkbox" checked="">
          </div>
          <input class="d-none" attribute-value value="${variantJSON}" />
        </td>
      `;
      variant.forEach(item => {
        // Hiển thị input cho Color, static text cho các attribute khác
        if(item.attrName == "Color") {
             tr += `
            <td>
                <input 
                  type="text" 
                  class="form-control" 
                  value="${item.label}"
                  name="variant_label_edit"
                  data-attr-index="${item.index}"
                  data-attr-name="${item.attrName}"
                >
            </td>
          `;
        } else {
             tr += `
            <td>${item.label}</td>
          `;
        }
      })
      tr += `
        <td>
          <input class="form-control" type="number" value="${priceWholeSale}" price-whole-sale>
        </td>
        <td>
          <input class="form-control" type="number" value="${priceOld}" price-old>
        </td>
        <td>
          <input class="form-control" type="number" value="${priceNew}" price-new>
        </td>
        <td>
          <input class="form-control" type="number" stock>
        </td>
      `;
      tr += "</tr>";
      variantBodyHTML += tr;
    })
    variantBody.innerHTML = variantBodyHTML;
  })
}
// End button-render-variant

// select-tag
const listSelectTag = document.querySelectorAll("[select-tag]");
if(listSelectTag.length > 0) {
  listSelectTag.forEach(selectTag => {
    let taggable = selectTag.getAttribute("taggable");

    new Selectr(selectTag, {
      taggable: taggable == "false" ? false : true
    });

    // Ngăn chặn sự kiện submit form
  const inputTag = selectTag.closest(".selectr-container").querySelector(".selectr-tag-input");
    if(inputTag) {
      inputTag.addEventListener("keydown", (event) => {
        if(event.key == "Enter") {
          event.preventDefault();
        }
      });
    }
  })
}
// End select-tag

// formImportExcel
const formImportExcel = document.querySelector("#formImportExcel");
if(formImportExcel) {
  const validation = new JustValidate('#formImportExcel');

  validation
    .addField('#file', [
      {
        rule: 'minFilesCount',
        value: 1,
        errorMessage: "Vui lòng chọn file CSV",
      },
      {
        rule: "files",
        value: {
          files: {
            extensions: ['csv'],
            types: ['text/csv'],
          },
        },
        errorMessage: "Vui lòng chọn đúng loại file CSV",
      },
    ])
    .onSuccess((event) => {
      const fileInput = event.target.querySelector("#file");
      const file = fileInput.files[0]; // chỉ lấy 1 file đầu tiên
      const api = formImportExcel.getAttribute("data-api");

      // Tạo FormData
      const formData = new FormData();
      formData.append("file", file);
      
      fetch(api, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End formImportExcel

// date-range
const dateRange = document.querySelector("[date-range]");
if(dateRange) {
  new DateRangePicker(dateRange, {
    format: 'dd/mm/yyyy'
  });
}
// End date-range

// Coupon Create Form
const couponCreateForm = document.querySelector("#couponCreateForm");
if(couponCreateForm) {
  const validation = new JustValidate('#couponCreateForm');

  validation
    .addField('#code', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mã giảm giá!'
      }
    ])
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên mã giảm giá!'
      }
    ])
    .onSuccess((event) => {
      const code = event.target.code.value;
      const name = event.target.name.value;
      const typeDiscount = event.target.typeDiscount.value;
      const value = event.target.value.value;
      const minOrderValue = event.target.minOrderValue.value;
      const maxDiscountValue = event.target.maxDiscountValue.value;
      const usageLimit = event.target.usageLimit.value;
      const typeDisplay = event.target.typeDisplay.value;
      const status = event.target.status.value;
      const startDate = event.target.startDate.value;
      const endDate = event.target.endDate.value;
      const description = tinymce.get("description").getContent();

      // Tạo FormData
      const formData = new FormData();
      formData.append("code", code);
      formData.append("name", name);
      formData.append("typeDiscount", typeDiscount);
      formData.append("value", value);
      formData.append("minOrderValue", minOrderValue);
      formData.append("maxDiscountValue", maxDiscountValue);
      formData.append("usageLimit", usageLimit);
      formData.append("typeDisplay", typeDisplay);
      formData.append("status", status);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("description", description);
      
      fetch(`/${pathAdmin}/coupon/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Coupon Create Form

// Coupon Edit Form
const couponEditForm = document.querySelector("#couponEditForm");
if(couponEditForm) {
  const validation = new JustValidate('#couponEditForm');

  validation
    .addField('#code', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mã giảm giá!'
      }
    ])
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên mã giảm giá!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const code = event.target.code.value;
      const name = event.target.name.value;
      const typeDiscount = event.target.typeDiscount.value;
      const value = event.target.value.value;
      const minOrderValue = event.target.minOrderValue.value;
      const maxDiscountValue = event.target.maxDiscountValue.value;
      const usageLimit = event.target.usageLimit.value;
      const typeDisplay = event.target.typeDisplay.value;
      const status = event.target.status.value;
      const startDate = event.target.startDate.value;
      const endDate = event.target.endDate.value;
      const description = tinymce.get("description").getContent();

      // Tạo FormData
      const formData = new FormData();
      formData.append("code", code);
      formData.append("name", name);
      formData.append("typeDiscount", typeDiscount);
      formData.append("value", value);
      formData.append("minOrderValue", minOrderValue);
      formData.append("maxDiscountValue", maxDiscountValue);
      formData.append("usageLimit", usageLimit);
      formData.append("typeDisplay", typeDisplay);
      formData.append("status", status);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("description", description);
      
      fetch(`/${pathAdmin}/coupon/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Coupon Edit Form

// format-money
const listFormatMoney = document.querySelectorAll("[format-money]");
if(listFormatMoney.length > 0) {
  listFormatMoney.forEach(input => {
    input.addEventListener("input", () => {
      let value = input.value;
      value = value.replace(/\./g, '');
      value = parseInt(value);
      const valueFomat = value.toLocaleString("vi-VN");
      input.value = valueFomat;
    })
  })
}
// End format-money