import { Request, Response } from "express";
import path from "path";
import pug from "pug";
import { domainCDN } from "../configs/variable.config";
import Template from "../models/template.model";
import Block from "../models/block.model";

export const renderHTML = (req: Request, res: Response, blockList: any) => {
  const blocksHtml: string[] = [];
  blockList.forEach((block: any) => {
    const blockPath = path.join(process.cwd(), "views", "client", "blocks", `${block.fileName}`);
    try {
      const html = pug.renderFile(blockPath, {
        categoryProductList: res.locals.categoryProductList,
        domainCDN: domainCDN,
        blockData: block.data
      });
      blocksHtml.push(html);
    } catch (error) {
      console.error(`Render lỗi cho block: ${block.fileName}`, error);
    }
  });
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