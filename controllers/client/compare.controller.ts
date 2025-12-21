import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';

export const compare = (req: Request, res: Response) => {
  res.render("client/pages/compare", {
    pageTitle: "So sánh sản phẩm"
  });
}

export const list = async (req: Request, res: Response) => {
  try {
    const compareList = req.body;
    const compareDetail: any[] = [];

    for (const item of compareList) {
      const productDetail = await Product.findOne({
        _id: item.productId,
        deleted: false,
        status: "active"
      })

      if(productDetail) {
        const attributeList = await AttributeProduct
          .find({
            _id: { $in: productDetail.attributes }
          })
          .select("id name")
          .lean();

        const itemDetail = {
          ...item,
          detail: {
            images: productDetail.images,
            slug: productDetail.slug,
            name: productDetail.name,
            description: productDetail.description,
            priceNew: productDetail.priceNew,
            priceOld: productDetail.priceOld,
            stock: productDetail.stock,
            attributeList: attributeList,
            variants: productDetail.variants
          }
        };

        compareDetail.push(itemDetail);
      }
    }

    res.json({
      code: "success",
      message: "Thành công!",
      compareList: compareDetail
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}