import axios from "axios";
import { getGeneral } from "../configs/setting.config";

export const pingGoogleSitemap = async () => {
  try {
    const settingGeneral = await getGeneral();
    const domain = settingGeneral.domainWebsite;
    const sitemapUrl = `${domain}/sitemap.xml`;
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    await axios.get(pingUrl);
    console.log("Ping Google sitemap thành công");
  } catch (error) {
    console.error(error);
    console.error("Ping Google sitemap thất bại");
  }
};