import { Request, Response } from 'express';
import { getGeneral } from '../../configs/setting.config';
import Product from '../../models/product.model';
import Blog from '../../models/blog.model';
import { pathAdmin } from '../../configs/variable.config';
// import Block from '../../models/block.model';
// import { renderHTML } from '../../helpers/block.helper';
import { getBlockListByTemplate, renderHTML } from '../../helpers/block.helper';

export const home = async (req: Request, res: Response) => {
  // const blockList = await Block.find({
  //   deleted: false,
  //   status: "active"
  // });
  const blockList = await getBlockListByTemplate("/");

  const blocksHtml = await renderHTML(req, res, blockList);

  res.render("client/pages/home", {
    pageTitle: "Trang chủ",
    blocksHtml: blocksHtml
  });
}

export const sitemap = async (req: Request, res: Response) => {
  try {
    const settingGeneral = await getGeneral();
    const domain = settingGeneral.domainWebsite;

    let urls: string[] = [];

    /*
      url: Đại diện cho 1 trang muốn Google index
      loc (location): Là URL đầy đủ của trang
      lastmod: Lần cập nhật gần nhất
      changefreq: Tần suất thay đổi (always: liên tục, hourly: giờ, daily: ngày, weekly: tuần, monthly: tháng, yearly: năm)
      priority: Mức độ quan trọng (mức độ ưu tiên của URL này so với các URL khác trong site)
    */

    // Trang chủ
    urls.push(`
      <url>
        <loc>${domain}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
    `);

    // Sản phẩm
    const productList = await Product.find({
      deleted: false,
      status: "active"
    }).select("slug updatedAt");

    productList.forEach(item => {
      urls.push(`
        <url>
          <loc>${domain}/product/detail/${item.slug}</loc>
          <lastmod>${item.updatedAt.toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>
      `);
    });

    // Bài viết
    const blogList = await Blog.find({
      deleted: false,
      status: "published"
    }).select("slug updatedAt");

    blogList.forEach(item => {
      urls.push(`
        <url>
          <loc>${domain}/article/detail/${item.slug}</loc>
          <lastmod>${item.updatedAt.toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `);
    });

    // XML sitemap
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${urls.join("")}
      </urlset>
    `;

    res.header("Content-Type", "application/xml");
    res.send(sitemapXml);

  } catch (error) {
    console.log(error);
    res.send("Lỗi khi tạo sitemap cho trang web.");
  }
};

export const robots = async (req: Request, res: Response) => {
  const content = `
    User-agent: *
    Disallow: /${pathAdmin}/
  `;

  /*
    User-agent: * nghĩa là áp dụng cho tất cả bot tìm kiếm
    Disallow: /admin/ nghĩa là không cho bot crawl bất kỳ URL nào bắt đầu bằng /admin/
  */

  res.type('text/plain');
  res.send(content);
};