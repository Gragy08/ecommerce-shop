import { Request, Response } from "express";
import axios from "axios";

export const search = async (req: Request, res: Response) => {
  try {
    const keyword = (req.query.keyword as string || "").trim();
    if (!keyword) {
      res.json({
        code: "error",
        message: "Vui lòng nhập từ khóa tìm kiếm."
      });
      return;
    }

    const apiKey = process.env.OPENMAP_API_KEY;
    const response = await axios.get(
      `https://mapapis.openmap.vn/v1/geocode/forward?format=google&address=${encodeURIComponent(keyword)}&apikey=${apiKey}`
    );

    const rawList = response.data?.results || [];
    const results = rawList.map((item: any) => ({
      address: item.formatted_address || item.address || item.name,
      lat: item.geometry?.location?.lat,
      lon: item.geometry?.location?.lng
    })).filter((item: any) => item.lat !== undefined && item.lon !== undefined);

    res.json({
      code: "success",
      results: results
    });
  } catch (error) {
    console.error("Lỗi tìm kiếm địa chỉ OpenMap:", error);
    res.json({
      code: "error",
      message: "Không thể tìm kiếm địa chỉ lúc này."
    });
  }
};

export const reverse = async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat as string;
    const lon = (req.query.lon || req.query.lng) as string;

    if (!lat || !lon) {
      res.json({
        code: "error",
        message: "Thiếu tọa độ."
      });
      return;
    }

    const apiKey = process.env.OPENMAP_API_KEY;
    const response = await axios.get(
      `https://mapapis.openmap.vn/v1/geocode/reverse?latlng=${lat},${lon}&apikey=${apiKey}`
    );

    const firstResult = response.data?.results?.[0];
    if (!firstResult) {
      res.json({
        code: "error",
        message: "Không tìm thấy địa chỉ cho tọa độ này."
      });
      return;
    }

    const address = firstResult.formatted_address || firstResult.address || firstResult.name || "";

    res.json({
      code: "success",
      address: address,
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    });
  } catch (error) {
    console.error("Lỗi lấy địa chỉ tọa độ OpenMap:", error);
    res.json({
      code: "error",
      message: "Không thể lấy địa chỉ từ bản đồ lúc này."
    });
  }
};
