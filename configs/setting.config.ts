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

export const getApiLoginSocial = async () => {
  const setting = await Setting.findOne({
    key: "apiLoginSocial"
  });
  return setting ? setting.data : null;
}

export const getApiAppPassword = async () => {
  const setting = await Setting.findOne({
    key: "apiAppPassword"
  });
  return setting ? setting.data : null;
}

export const getGeneral = async () => {
  const setting = await Setting.findOne({
    key: "general"
  });
  return setting ? setting.data : null;
}

export interface WholesalePolicyConfig {
  enabled: boolean;
  minQuantity: number;
  minOrderTotal: number;
  conditionMode: "or" | "and";
  countOnlyImei: boolean;
  allowPosOverride: boolean;
  policyNote: string;
}

export const defaultWholesalePolicy: WholesalePolicyConfig = {
  enabled: true,
  minQuantity: 3,
  minOrderTotal: 20000000,
  conditionMode: "or",
  countOnlyImei: true,
  allowPosOverride: true,
  policyNote: "Đơn hàng đại lý yêu cầu từ 3 thiết bị trở lên hoặc tổng giá trị đơn hàng từ 20.000.000đ."
};

export const getWholesalePolicy = async (): Promise<WholesalePolicyConfig> => {
  const setting = await Setting.findOne({
    key: "wholesale_policy"
  }).lean();
  if (!setting || !setting.data) {
    return { ...defaultWholesalePolicy };
  }
  const data = setting.data as Partial<WholesalePolicyConfig>;
  return {
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : defaultWholesalePolicy.enabled,
    minQuantity: Math.max(1, Number(data.minQuantity) || defaultWholesalePolicy.minQuantity),
    minOrderTotal: Math.max(0, Number(data.minOrderTotal) || defaultWholesalePolicy.minOrderTotal),
    conditionMode: data.conditionMode === "and" ? "and" : "or",
    countOnlyImei: data.countOnlyImei !== undefined ? Boolean(data.countOnlyImei) : defaultWholesalePolicy.countOnlyImei,
    allowPosOverride: data.allowPosOverride !== undefined ? Boolean(data.allowPosOverride) : defaultWholesalePolicy.allowPosOverride,
    policyNote: typeof data.policyNote === "string" ? data.policyNote.trim() : defaultWholesalePolicy.policyNote
  };
};