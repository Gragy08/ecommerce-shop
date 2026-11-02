import { Request, Response } from "express";
import path from "path";
import pug from "pug";
import { domainCDN } from "../configs/variable.config";
import Template from "../models/template.model";
import Block from "../models/block.model";
import { getProductByCategory } from "./product.helper";

export const renderHTML = async (req: Request, res: Response, blockList: any) => {
  const blocksHtml: string[] = [];
  for(const block of blockList) {
    const blockPath = path.join(process.cwd(), "views", "client", "blocks", `${block.fileName}`);
    try {
      // Lấy ra sản phẩm
      let productList: any[] = [];
      if (block.data?.getByCategory?.type === "product") {
        productList = await getProductByCategory(block.data.getByCategory);
      }
      // Hết Lấy ra sản phẩm

      // Lấy ra dữ liệu theo tab
      let tabList: any[] = [];
      if(block.data?.tabs?.length > 0) {
        for(const tab of block.data.tabs) {
          if(tab.getByCategory?.type === "product") {
            const productListByTab = await getProductByCategory(tab.getByCategory);
            tabList.push({
              ...tab,
              productList: productListByTab
            });
          }
        }
      }
      // Hết Lấy ra dữ liệu theo tab

      const html = pug.renderFile(blockPath, {
        categoryProductList: res.locals.categoryProductList,
        domainCDN: domainCDN,
        blockData: block.data,
        blockProductList: productList,
        blockTabList: tabList
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