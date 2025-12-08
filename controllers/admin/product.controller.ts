import { Request, Response } from 'express';
import CategoryProduct from '../../models/category-product.model';
import slugify from 'slugify';
import { buildCategoryTree } from '../../helpers/category.helper';
import { pathAdmin } from '../../configs/variable.config';
import Product from '../../models/product.model';
import { logAdminAction } from '../../helpers/log.helper';
import AttributeProduct from '../../models/attribute-product.model';
import { Parser } from 'json2csv';
import Papa from 'papaparse';
import { generateRandomString } from '../../helpers/generate.helper';


export const category = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: " ",
      lower: true
    });
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page && parseInt(`${req.query.page}`) > 0) {
    page = parseInt(`${req.query.page}`);
  }
  const totalRecord = await CategoryProduct.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    totalRecord: totalRecord,
    totalPage: totalPage,
    skip: skip
  };
  // Hết Phân trang

  const recordList: any = await CategoryProduct
    .find(find)
    .sort({
      createdAt: "desc"
    })
    .limit(limitItems)
    .skip(skip)

  for (const item of recordList) {
    if(item.parent) {
      const parent = await CategoryProduct.findOne({
        _id: item.parent
      })

      item["parentName"] = parent?.name;
    }
  }

  res.render("admin/pages/product-category", {
    pageTitle: "Quản lý danh mục sản phẩm",
    recordList: recordList,
    pagination: pagination
  });
}

export const createCategory = async (req: Request, res: Response) => {
  const categoryList = await CategoryProduct.find({});

  const categoryTree = buildCategoryTree(categoryList);

  res.render("admin/pages/product-create-category", {
    pageTitle: "Tạo danh mục sản phẩm",
    categoryList: categoryTree
  });
}

export const createCategoryPost = async (req: Request, res: Response) => {
  try {
    const existSlug = await CategoryProduct.findOne({
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    const newRecord = new CategoryProduct(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Tạo danh mục thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const editCategory = async (req: Request, res: Response) => {
  try {
    const categoryList = await CategoryProduct.find({});

    const categoryTree = buildCategoryTree(categoryList);

    const id = req.params.id;

    const categoryDetail = await CategoryProduct.findOne({
      _id: id,
      deleted: false
    })

    if(!categoryDetail) {
      res.redirect(`/${pathAdmin}/product/category`);
      return;
    }

    res.render("admin/pages/product-edit-category", {
      pageTitle: "Chỉnh sửa danh mục sản phẩm",
      categoryList: categoryTree,
      categoryDetail: categoryDetail
    });
  } catch (error) {
    res.redirect(`/${pathAdmin}/product/category`);
  }
}

export const editCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const existSlug = await CategoryProduct.findOne({
      _id: { $ne: id }, // Loại trừ bản ghi có _id trùng với id truyền vào
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    await CategoryProduct.updateOne({
      _id: id,
      deleted: false
    }, req.body)

    res.json({
      code: "success",
      message: "Cập nhật thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const deleteCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await CategoryProduct.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now()
    })

    res.json({
      code: "success",
      message: "Xóa danh mục thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}

export const create = async (req: Request, res: Response) => {
  const categoryList = await CategoryProduct.find({
    deleted: false
  });

  const categoryTree = buildCategoryTree(categoryList);

  const attributeList = await AttributeProduct.find({
    deleted: false
  });

  res.render("admin/pages/product-create", {
    pageTitle: "Tạo sản phẩm",
    categoryList: categoryTree,
    attributeList: attributeList
  });
}

export const createPost = async (req: Request, res: Response) => {
  try {
    const existSlug = await Product.findOne({
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    if(req.body.position) {
      req.body.position = parseInt(req.body.position);
    } else {
      // Nếu không truyền position -> lấy position lớn nhất + 1
      const recordMaxPosition = await Product
        .findOne({})
        .sort({
          position: "desc"
        });
      if(recordMaxPosition && recordMaxPosition.position) {
        req.body.position = recordMaxPosition.position + 1;
      } else {
        req.body.position = 1;
      }
    }

    req.body.category = JSON.parse(req.body.category);

    req.body.images = JSON.parse(req.body.images);

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    if(req.body.priceWholeSale) {
      req.body.priceWholeSale = parseInt(req.body.priceWholeSale);
    }

    if(req.body.priceOld) {
      req.body.priceOld = parseInt(req.body.priceOld);
    }

    if(req.body.priceNew) {
      req.body.priceNew = parseInt(req.body.priceNew);
      req.body.discount = Math.floor(((req.body.priceOld - req.body.priceNew) / req.body.priceOld) * 100);
    } else {
      req.body.priceNew = req.body.priceOld;
      req.body.discount = 0;
    }

    if(req.body.stock) {
      req.body.stock = parseInt(req.body.stock);
    }

    req.body.attributes = JSON.parse(req.body.attributes);

    req.body.variants = JSON.parse(req.body.variants);

    req.body.tags = JSON.parse(req.body.tags);

    req.body.sku = generateRandomString(10).toUpperCase();

    const newRecord = new Product(req.body);
    await newRecord.save();

    logAdminAction(req, `Đã tạo sản phẩm: ${req.body.name} (Id: ${newRecord.id})`);

    res.json({
      code: "success",
      message: "Tạo sản phẩm thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: ' ',
      lower: true, // Chữ thường
    })
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page) {
    const currentPage = parseInt(`${req.query.page}`);
    if(currentPage > 0) {
      page = currentPage;
    }
  }
  const totalRecord = await Product.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    skip: skip,
    totalRecord: totalRecord,
    totalPage: totalPage
  };
  // Hết Phân trang

  const recordList: any = await Product
    .find(find)
    .limit(limitItems)
    .skip(skip)
    .sort({
      position: "desc"
    });

  res.render("admin/pages/product-list", {
    pageTitle: "Quản lý sản phẩm",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const categoryList = await CategoryProduct.find({
      deleted: false
    });

    const categoryTree = buildCategoryTree(categoryList);

    const attributeList = await AttributeProduct.find({
      deleted: false
    });

    const id = req.params.id;

    const productDetail = await Product.findOne({
      _id: id,
      deleted: false
    })

    if(!productDetail) {
      res.redirect(`/${pathAdmin}/product/list`);
      return;
    }

    // Thuộc tính đã chọn
    const attributeNameList: string[] = [];
    productDetail.attributes.forEach(attrId => {
      const attributeInfo = attributeList.find(item => item.id === attrId);
      if(attributeInfo) {
        attributeNameList.push(`${attributeInfo.name}`);
      }
    });

    res.render("admin/pages/product-edit", {
      pageTitle: "Chỉnh sửa sản phẩm",
      categoryList: categoryTree,
      attributeList: attributeList,
      productDetail: productDetail,
      attributeNameList: attributeNameList
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/product/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const productDetail = await Product.findOne({
      _id: id,
      deleted: false
    })

    if(!productDetail) {
      res.json({
        code: "error",
        message: "Sản phẩm không tồn tại!"
      });
      return;
    }

    const existSlug = await Product.findOne({
      _id: { $ne: id },
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    if(req.body.position) {
      req.body.position = parseInt(req.body.position);
    } else {
      // Nếu không truyền position -> lấy position lớn nhất + 1
      const recordMaxPosition = await Product
        .findOne({})
        .sort({
          position: "desc"
        });
      if(recordMaxPosition && recordMaxPosition.position) {
        req.body.position = recordMaxPosition.position + 1;
      } else {
        req.body.position = 1;
      }
    }

    req.body.category = JSON.parse(req.body.category);

    req.body.images = JSON.parse(req.body.images);

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    if(req.body.priceWholeSale) {
      req.body.priceWholeSale = parseInt(req.body.priceWholeSale);
    }

    if(req.body.priceOld) {
      req.body.priceOld = parseInt(req.body.priceOld);
    }

    if(req.body.priceNew) {
      req.body.priceNew = parseInt(req.body.priceNew);
      req.body.discount = Math.floor(((req.body.priceOld - req.body.priceNew) / req.body.priceOld) * 100);
    } else {
      req.body.priceNew = req.body.priceOld;
      req.body.discount = 0;
    }

    if(req.body.stock) {
      req.body.stock = parseInt(req.body.stock);
    }

    req.body.attributes = JSON.parse(req.body.attributes);

    req.body.variants = JSON.parse(req.body.variants);

    req.body.tags = JSON.parse(req.body.tags);

    if(!productDetail.sku) {
      req.body.sku = generateRandomString(10).toUpperCase();
    }

    await Product.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    logAdminAction(req, `Đã sửa sản phẩm: ${productDetail.name} (Id: ${productDetail.id})`);

    res.json({
      code: "success",
      message: "Cập nhật sản phẩm thành công!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    });
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await Product.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now(),
    });

    res.json({
      code: "success",
      message: "Xóa sản phẩm thành công!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}

export const attribute = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: ' ',
      lower: true, // Chữ thường
    })
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page) {
    const currentPage = parseInt(`${req.query.page}`);
    if(currentPage > 0) {
      page = currentPage;
    }
  }
  const totalRecord = await AttributeProduct.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    skip: skip,
    totalRecord: totalRecord,
    totalPage: totalPage
  };
  // Hết Phân trang

  const recordList: any = await AttributeProduct
    .find(find)
    .limit(limitItems)
    .skip(skip)
    .sort({
      createdAt: "desc"
    });

  res.render("admin/pages/product-attribute", {
    pageTitle: "Quản lý thuộc tính sản phẩm",
    recordList: recordList,
    pagination: pagination
  });
}

export const createAttribute = async (req: Request, res: Response) => {
  res.render("admin/pages/product-create-attribute", {
    pageTitle: "Tạo thuộc tính sản phẩm"
  });
}

export const createAttributePost = async (req: Request, res: Response) => {
  try {
    req.body.options = JSON.parse(req.body.options);

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    const newRecord = new AttributeProduct(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Tạo thuộc tính thành công!"
    })
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const editAttribute = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const attributeDetail = await AttributeProduct.findOne({
      _id: id,
      deleted: false
    })

    if(!attributeDetail) {
      res.redirect(`/${pathAdmin}/product/attribute`);
      return;
    }

    res.render("admin/pages/product-edit-attribute", {
      pageTitle: "Chỉnh sửa thuộc tính sản phẩm",
      attributeDetail: attributeDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/product/attribute`);
  }
}

export const editAttributePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    req.body.options = JSON.parse(req.body.options);
    
    req.body.search = slugify(req.body.name, {
      replacement: ' ',
      lower: true, // Chữ thường
    })

    await AttributeProduct.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Cập nhật thuộc tính thành công!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const deleteAttributePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await AttributeProduct.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now(),
    });

    res.json({
      code: "success",
      message: "Xóa thuộc tính thành công!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}

export const exportCSV = async (req: Request, res: Response) => {
  try {
    const productList = await Product.find().lean();

    // Chuyển JSON sang CSV
    const parser = new Parser();
    let csv = parser.parse(productList);
    csv = '\ufeff' + csv;

    res.header('Content-Type', 'text/csv');
    res.attachment('products.csv');

    res.send(csv);
  } catch (error) {
    console.log(error);
  }
}

export const importCSVPost = async (req: Request, res: Response) => {
  try {
    // Chuyển CSV sang JS
    const result = Papa.parse(`${req.file?.buffer}`, {
      header: true,
      skipEmptyLines: true
    });

    const items: any[] = result.data;

    for (const item of items) {
      item.position = item.position ? parseInt(item.position) : 0;
      item.category = item.category ? JSON.parse(item.category) : [];
      item.priceOld = item.priceOld ? parseInt(item.priceOld) : 0;
      item.priceNew = item.priceNew ? parseInt(item.priceNew) : 0;
      item.stock = item.stock ? parseInt(item.stock) : 0;
      item.attributes = item.attributes ? JSON.parse(item.attributes) : [];
      item.variants = item.variants ? JSON.parse(item.variants) : [];
      item.images = item.images ? JSON.parse(item.images) : [];
      item.view = item.view ? parseInt(item.view) : 0;
      item.tags = item.tags ? JSON.parse(item.tags) : [];
      item.deleted = item.deleted == "true" ? true : false;
      item.deletedAt = item.deletedAt ? new Date(item.deletedAt) : undefined;
      item.createdAt = item.createdAt ? new Date(item.createdAt) : undefined;
      item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : undefined;

      await Product.updateOne({
        _id: item._id
      }, item);
    }

    res.json({
      code: "success",
      message: "Upload file thành công!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}