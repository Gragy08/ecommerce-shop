import { Request, Response } from "express";
import path from "path";
import pug from "pug";
import { domainCDN } from "../configs/variable.config";
import Template from "../models/template.model";
import Block from "../models/block.model";
import CategoryProduct from "../models/category-product.model";
import Product from "../models/product.model";
import { formatProductItem } from "./product.helper";

export const renderHTML = async (req: Request, res: Response, blockList: any) => {
  const blocksHtml: string[] = [];
  for(const block of blockList) {
    const blockPath = path.join(process.cwd(), "views", "client", "blocks", `${block.fileName}`);
    try {
      // Lấy ra sản phẩm
      let productList: any[] = [];
      if (block.data?.getByCategory?.type === "product") {
        const { getByCategory } = block.data;

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
      }
      // Hết Lấy ra sản phẩm

      const html = pug.renderFile(blockPath, {
        categoryProductList: res.locals.categoryProductList,
        domainCDN: domainCDN,
        blockData: block.data,
        blockProductList: productList
      });
      blocksHtml.push(html);
    } catch (error) {
      console.error(`Render lỗi cho block: ${block.fileName}`, error);
    }
  }
  return blocksHtml;
}

export const getBlockListByTemplate = async (slug: string) => {
  // Lấy template
  const template: any = await Template.findOne({
    slug: slug,
    deleted: false,
    status: "active"
  })

  const blockIds = template.blocks.map((item: any) => item.blockId);
  
  const blockList = await Block.find({
    _id: { $in: blockIds },
    deleted: false,
    status: "active"
  });

  // Sắp xếp lại theo đúng thứ tự
  const sortedBlocks = blockIds.map((blockId: string) => {
    return blockList.find((block: any) => block.id == blockId);
  });

  return sortedBlocks;
}