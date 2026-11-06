import axios from "axios";
import { getApiShipping } from "../configs/setting.config";

const cache: {
  cities: any[];
  districts: Map<string, any[]>;
  wards: Map<string, any[]>;
} = {
  cities: [],
  districts: new Map(),
  wards: new Map()
};

const getCachedCities = async (token: string): Promise<any[]> => {
  if (cache.cities.length > 0) return cache.cities;
  const res = await axios.get("https://sandbox.goship.io/api/v2/cities", {
    headers: { Authorization: `Bearer ${token}` }
  });
  cache.cities = res.data?.data || [];
  return cache.cities;
};

const getCachedDistricts = async (cityId: string, token: string): Promise<any[]> => {
  if (cache.districts.has(cityId)) return cache.districts.get(cityId)!;
  const res = await axios.get(`https://sandbox.goship.io/api/v2/cities/${cityId}/districts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const list = res.data?.data || [];
  cache.districts.set(cityId, list);
  return list;
};

const getCachedWards = async (districtId: string, token: string): Promise<any[]> => {
  if (cache.wards.has(districtId)) return cache.wards.get(districtId)!;
  const res = await axios.get(`https://sandbox.goship.io/api/v2/districts/${districtId}/wards`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const list = res.data?.data || [];
  cache.wards.set(districtId, list);
  return list;
};

const cleanStr = (str: string) => {
  if (!str) return "";
  let s = str.toLowerCase().trim();
  // Bỏ các tiền tố hành chính phổ biến
  s = s.replace(/^(tỉnh|thành phố|tp\.?|quận|huyện|thị xã|tx\.?|phường|p\.?|xã|thị trấn|tt\.?)\s+/i, "").trim();
  // Chuẩn hóa số (ví dụ: '04' -> '4') để so khớp các phường đánh số
  s = s.replace(/^0+([1-9][0-9]*)$/, "$1");
  return s;
};

const ALIASES: Record<string, string> = {
  "hồ chí minh": "hồ chí minh",
  "thành phố hồ chí minh": "hồ chí minh",
  "tp.hcm": "hồ chí minh",
  "tp hcm": "hồ chí minh",
  "sài gòn": "hồ chí minh",
  "thừa thiên huế": "thừa thiên huế",
  "huế": "thừa thiên huế",
  "bà rịa vũng tàu": "bà rịa - vũng tàu",
  "bà rịa - vũng tàu": "bà rịa - vũng tàu",
  "thủ đức": "thành phố thủ đức",
  "tp thủ đức": "thành phố thủ đức"
};

const normalizeAddress = async (city: string, district: string, ward: string) => {
  const apiShipping = await getApiShipping();
  const token = apiShipping?.tokenGoShip;
  if (!token) {
    throw new Error("Chưa cấu hình mã xác thực GoShip.");
  }

  // Thông tin tỉnh/thành
  const cities = await getCachedCities(token);
  const targetCityClean = cleanStr(ALIASES[city.toLowerCase().trim()] || city);
  let cityInfo = cities.find((item: any) => cleanStr(item.name) === targetCityClean);
  if (!cityInfo) {
    cityInfo = cities.find((item: any) => cleanStr(item.name).includes(targetCityClean) || targetCityClean.includes(cleanStr(item.name)));
  }
  if (!cityInfo) {
    throw new Error(`GoShip không tìm thấy tỉnh/thành: ${city}`);
  }

  // Thông tin quận/huyện
  const districts = await getCachedDistricts(cityInfo.id, token);
  const targetDistrictClean = cleanStr(ALIASES[district.toLowerCase().trim()] || district);
  let districtInfo = districts.find((item: any) => cleanStr(item.name) === targetDistrictClean);
  if (!districtInfo) {
    districtInfo = districts.find((item: any) => cleanStr(item.name).includes(targetDistrictClean) || targetDistrictClean.includes(cleanStr(item.name)));
  }
  if (!districtInfo) {
    throw new Error(`GoShip không tìm thấy quận/huyện: ${district}`);
  }

  // Thông tin phường/xã
  const wards = await getCachedWards(districtInfo.id, token);
  const targetWardClean = cleanStr(ward);
  // Ưu tiên 1: So khớp chính xác sau khi đã loại tiền tố và bỏ số 0 vô nghĩa ('4' === '4' hay '04' -> '4')
  let wardInfo = wards.find((item: any) => cleanStr(item.name) === targetWardClean);
  // Ưu tiên 2: So khớp theo word boundary
  if (!wardInfo) {
    const regex = new RegExp(`(^|\\s)${targetWardClean}(\\s|$)`, "i");
    wardInfo = wards.find((item: any) => regex.test(cleanStr(item.name)));
  }
  // Ưu tiên 3: Nếu là chữ (không phải thuần số) thì tìm theo includes
  if (!wardInfo && !/^\d+$/.test(targetWardClean)) {
    wardInfo = wards.find((item: any) => cleanStr(item.name).includes(targetWardClean) || targetWardClean.includes(cleanStr(item.name)));
  }
  if (!wardInfo) {
    console.warn(`GoShip không tìm thấy phường/xã "${ward}" trong quận "${districtInfo.name}".`);
    throw new Error(`GoShip không tìm thấy phường/xã: ${ward}`);
  }

  const dataFinal = {
    city: cityInfo.id,
    district: districtInfo.id,
    ward: wardInfo.id
  };

  return dataFinal;
};

export const getInfoAddress = async (latitude: number, longitude: number) => {
  const geoRes = await axios.get(`https://mapapis.openmap.vn/v1/geocode/reverse?latlng=${latitude},${longitude}&apikey=${process.env.OPENMAP_API_KEY}`);

  let city = "";
  let district = "";
  let ward = "";

  const addressArray = geoRes.data.results?.[0]?.address_components;
  if (!addressArray) {
    throw new Error("OpenMap không tìm thấy địa chỉ từ tọa độ.");
  }

  const province = addressArray.find((item: any) => item.long_name.toLowerCase().includes("tỉnh"));
  const cityParts = addressArray.filter((item: any) => item.long_name.toLowerCase().includes("thành phố"));
  const outerCityPart = cityParts[cityParts.length - 1];
  const innerCityPart = cityParts.length > 1 ? cityParts[cityParts.length - 2] : undefined;
  const districtPart = addressArray.find((item: any) => {
    const name = item.long_name.toLowerCase();
    return name.includes("quận") || name.includes("huyện") || name.includes("thị xã");
  });
  const wardPart = addressArray.find((item: any) => {
    const name = item.long_name.toLowerCase();
    return name.includes("phường") || name.includes("xã") || name.includes("thị trấn");
  });

  city = province?.short_name || outerCityPart?.short_name || "";
  district = districtPart?.short_name || innerCityPart?.short_name || (province ? outerCityPart?.short_name : "") || "";
  ward = wardPart?.short_name || "";

  if (!city || !district || !ward) {
    throw new Error("OpenMap thiếu tỉnh/thành, quận/huyện hoặc phường/xã/thị trấn cho tọa độ này.");
  }

  const result = await normalizeAddress(city, district, ward);

  return result;
};
