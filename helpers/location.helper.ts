import axios from "axios";

const normalizeAddress = async (city: string, district: string, ward: string) => {
  // Thông tin tỉnh/thành
  const cityRes = await axios.get("https://sandbox.goship.io/api/v2/cities", {
    headers: {
      Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`
    }
  });
  const cityInfo = cityRes.data.data.find((item: any) => item.name == city);

  // Thông tin quận/huyện
  const districtRes = await axios.get(`https://sandbox.goship.io/api/v2/cities/${cityInfo.id}/districts`, {
    headers: {
      Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`
    }
  });

  const districtInfo = districtRes.data.data.find((item: any) => item.name.includes(district));

  // Thông tin phường/xã
  const wardRes = await axios.get(`https://sandbox.goship.io/api/v2/districts/${districtInfo.id}/wards`, {
    headers: {
      Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`
    }
  });

  const wardInfo = wardRes.data.data.find((item: any) => item.name.includes(ward));

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

  const addressArray = geoRes.data.results[0].address_components;
  
  for (const item of addressArray) {
    const name = item.long_name.toLowerCase();

    if (name.includes("thành phố") || name.includes("tỉnh")) {
      city = item.short_name;
    }

    if (name.includes("quận") || name.includes("huyện") || name.includes("thị xã")) {
      district = item.short_name;
    }
    
    if (name.includes("phường") || name.includes("xã")) {
      ward = item.short_name;
    }
  }

  const result = await normalizeAddress(city, district, ward);

  return result;
}
