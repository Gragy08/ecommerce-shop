import Setting from "../models/setting.model";

export const getApiShipping = async () => {
  const setting = await Setting.findOne({
    key: "apiShipping"
  });
  return setting ? setting.data : null;
}

export const getApiPayment = async () => {
  const setting = await Setting.findOne({
    key: "apiPayment"
  });
  return setting ? setting.data : null;
}