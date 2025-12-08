import { Request, Response } from 'express';
import CategoryProduct from '../../models/category-product.model';
import Product from '../../models/product.model';
import slugify from 'slugify';
import AttributeProduct from '../../models/attribute-product.model';

export const productByCategory = async (req: Request, res: Response) => {
  const slug = req.params.slug;
  let categoryDetail: any = null;

  if(slug) {
    categoryDetail = await CategoryProduct.findOne({
      slug: slug,
      deleted: false,
      status: "active"
    })
  } else {
    categoryDetail = {
      id: "",
      name: "Tất cả sản phẩm",
      slug: ""
    };
  }

  if(!categoryDetail) {
    res.redirect("/");
    return;
  }

  const find: {
    category?: string,
    status: string,
    deleted: boolean,
    priceNew?: {
      $gte: number,
      $lte: number
    },
    discount?: {
      $gt: number
    },
    stock?: {
      $gt: number
    },
    $or?: any,
    search?: RegExp
  } = {
    deleted: false,
    status: "active",
  };

  // Danh mục
  if(categoryDetail.id) {
    find.category = categoryDetail.id;
  }
  // Hết Danh mục

  // Từ khóa
  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: " ",
      lower: true
    });
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }
  // Hết Từ khóa

  // Mức giá
  if(req.query.price) {
    const [priceMin, priceMax] = `${req.query.price}`.split("-").map(item => parseInt(item));
    find.priceNew = {
      $gte: priceMin,
      $lte: priceMax
    };
  }
  // Hết Mức giá

  // Đang giảm giá
  if(req.query.onSale && req.query.onSale == "true") {
    find.discount = {
      $gt: 0
    }
  }
  // Hết Đang giảm giá

  // Còn hàng
  if(req.query.inStock && req.query.inStock == "true") {
    find.stock = {
      $gt: 0
    }
  }
  // Hết Còn hàng

  // Thuộc tính
  const attributeFilters: any[] = [];

  Object.keys(req.query).forEach(key => {
    if(key.startsWith("attribute_")) {
      const attrId = key.replace("attribute_", "");
      const values = `${req.query[key]}`.split(",");
      
      attributeFilters.push(
        {
          variants: {
            $elemMatch: {
              status: true,
              attributeValue: {
                $elemMatch: {
                  attrId: attrId,
                  value: { $in: values }
                }
              }
            }
          }
        }
      );

      if(attributeFilters.length > 0) {
        find.$or = attributeFilters;
      }
    }
  })
  // Hết Thuộc tính

  // Phân trang
  let limitItems = 20;
  if(req.query.limitItems) {
    const currentLimitItems = parseInt(`${req.query.limitItems}`);
    if(currentLimitItems > 0) {
      limitItems = currentLimitItems;
    }
  }

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
    totalPage: totalPage,
    currentPage: page,
    totalRecord: totalRecord,
    skip: skip
  };
  // Hết Phân trang

  // Sắp xếp
  const sort: any = {};
  if(req.query.sort) {
    const [sortKey, sortValue] = `${req.query.sort}`.split("-");
    switch (sortKey) {
      case "position":
        sort.position = sortValue;
        break;
      case "price":
        sort.priceNew = sortValue;
        sort.position = sortValue;
        break;
      case "createdAt":
        sort.createdAt = sortValue;
        break;
      case "discount":
        sort.discount = sortValue;
        sort.position = sortValue;
        break;
      default:
        sort.position = "desc";
        break;
    }
  } else {
    sort.position = "desc";
  }
  // Hết Sắp xếp

  const productList: any = await Product
    .find(find)
    .limit(limitItems)
    .skip(skip)
    .sort(sort)

  for (const item of productList) {
    // Giảm giá
    item.discount = Math.floor(((item.priceOld - item.priceNew) / item.priceOld) * 100);

    // Màu sắc
    const colorSet = new Set();
    item.variants
      .filter((variant: any) => variant.status)
      .forEach((variant: any) => {
        variant.attributeValue.forEach((attr: any) => {
          if(attr.attrType == "color") {
            colorSet.add(attr.value);
          }
        })
      })
    item.colorList = [...colorSet];
  }

  res.render("client/pages/product-by-category", {
    pageTitle: categoryDetail.name,
    categoryDetail: categoryDetail,
    productList: productList,
    pagination: pagination
  });
}

export const suggest = async (req: Request, res: Response) => {
  const find: {
    status: string,
    deleted: boolean,
    priceNew: {
      $gt: number
    },
    stock: {
      $gt: number
    },
    search?: RegExp
  } = {
    deleted: false,
    status: "active",
    priceNew: {
      $gt: 0
    },
    stock: {
      $gt: 0
    }
  };

  // Từ khóa
  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: " ",
      lower: true
    });
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }
  // Hết Từ khóa

  const productList = await Product
    .find(find)
    .limit(5)
    .sort({
      position: "desc"
    })
    .select("images name slug priceNew priceOld")
    .lean();

  res.json({
    code: "success",
    message: "Thành công!",
    list: productList
  })
}

export const detail = async (req: Request, res: Response) => {
  const productDetail:any = await Product.findOne({
    slug: req.params.slug,
    deleted: false,
    status: "active"
  })

  if(!productDetail) {
    res.redirect("/");
    return;
  }

  // Danh sách thuộc tính
  const attributeList: any = await AttributeProduct.find({
    _id: { $in: productDetail.attributes }
  })
  for (const attribute of attributeList) {
    const variantSet = new Set();
    const variantLabelSet = new Set();
    productDetail.variants
      .filter((variant: any) => variant.status)
      .forEach((variant: any) => {
        variant.attributeValue.forEach((attr: any) => {
          if(attr.attrId == attribute.id) {
            variantSet.add(attr.value);
            variantLabelSet.add(attr.label);
          }
        })
      })
    attribute.variants = [...variantSet];
    attribute.variantsLabel = [...variantLabelSet];
  }
  // Hết Danh sách thuộc tính

  // Danh sách danh mục
  const categoryList = await CategoryProduct
    .find({
      _id: { $in: productDetail.category },
      deleted: false,
      status: "active"
    })
    .select("name slug");
  productDetail.categoryList = categoryList;
  // Hết Danh sách danh mục

  res.render("client/pages/product-detail", {
    pageTitle: productDetail.name,
    productDetail: productDetail,
    attributeList: attributeList
  });
}