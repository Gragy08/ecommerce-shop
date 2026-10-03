import axios from "axios";

const normalizeAddress = async (city: string, district: string, ward: string) => {
  // Thông tin tỉnh/thành
  const cityRes = await axios.get("https://sandbox.goship.io/api/v2/cities", {
    headers: {
      Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`
    }
  });
  const cityInfo = cityRes.data.data.find((item: any) => item.name.toLowerCase().includes(city.toLowerCase()));
  if (!cityInfo) {
    throw new Error(`GoShip không tìm thấy tỉnh/thành: ${city}`);
  }

  // Thông tin quận/huyện
  const districtRes = await axios.get(`https://sandbox.goship.io/api/v2/cities/${cityInfo.id}/districts`, {
    headers: {
      Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`
    }
  });

  const districtInfo = districtRes.data.data.find((item: any) => item.name.toLowerCase().includes(district.toLowerCase()));
  if (!districtInfo) {
    throw new Error(`GoShip không tìm thấy quận/huyện: ${district}`);
  }

  // Thông tin phường/xã
  const wardRes = await axios.get(`https://sandbox.goship.io/api/v2/districts/${districtInfo.id}/wards`, {
    headers: {
      Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`
    }
  });

  const wardInfo = wardRes.data.data.find((item: any) => item.name.toLowerCase().includes(ward.toLowerCase()));
  if (!wardInfo) {
    throw new Error(`GoShip không tìm thấy phường/xã: ${ward}`);
  }

  const dataFinal = {
    city: cityInfo.id,
    district: districtInfo.id,
    ward: wardInfo.id
  };

  return dataFinal;
}

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
}
