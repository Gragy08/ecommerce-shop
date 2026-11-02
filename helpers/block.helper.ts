import { Request, Response } from "express";
import path from "path";
import pug from "pug";
import { domainCDN } from "../configs/variable.config";

export const renderHTML = (req: Request, res: Response, blockList: any) => {
  const blocksHtml: string[] = [];
  blockList.forEach((block: any) => {
    const blockPath = path.join(process.cwd(), "views", "client", "blocks", `${block.fileName}`);
    try {
      const html = pug.renderFile(blockPath, {
        categoryProductList: res.locals.categoryProductList,
        domainCDN: domainCDN
      });
      blocksHtml.push(html);
    } catch (error) {
      console.error(`Render lỗi cho block: ${block.fileName}`, error);
    }
  });
  return blocksHtml;
}