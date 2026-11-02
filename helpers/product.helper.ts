import CategoryProduct from "../models/category-product.model";
import Product from "../models/product.model";

export const formatProductItem = (item: any) => {
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

export const getProductByCategory = async (getByCategory: any) => {
  let productList: any[] = [];

  // Tạo đối tượng tìm kiếm
  const find: any = {
    deleted: false,
    status: "active"
  };

  // Lấy mảng id các danh mục
  if(getByCategory.category && getByCategory.category.length) {
    const categoryList = await CategoryProduct.find({
      slug: { $in: getByCategory.category },
      deleted: false,
      status: "active"
    });
    const categoryIds = categoryList.map((category: any) => category.id);
    find.category = { $in: categoryIds };
  }

  // Lấy giới hạn sản phẩm
  let limit = 10;
  if(getByCategory.limit) {
    limit = getByCategory.limit;
  }

  // Sắp xếp
  const sort: any = {};
  if(getByCategory.sort && getByCategory.sort.by && getByCategory.sort.type) {
    sort[getByCategory.sort.by] = getByCategory.sort.type;
  }

  // Lấy ra sản phẩm
  productList = await Product
    .find(find)
    .sort(sort)
    .limit(limit);
  
  for(const item of productList) {
    formatProductItem(item);
  }

  return productList;
}