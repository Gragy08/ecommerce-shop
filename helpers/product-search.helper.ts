import mongoose from "mongoose";
import slugify from "slugify";
import Product from "../models/product.model";
import ProductVariant from "../models/product-variant.model";
import InventoryItem from "../models/inventory-item.model";

/**
 * Xóa dấu tiếng Việt và chuẩn hóa về chữ thường
 */
export const removeVietnameseTones = (str: string): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
};

/**
 * Escape các ký tự đặc biệt trong Regex
 */
export const escapeRegex = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Bảng từ đồng nghĩa thông dụng cho màu sắc & dung lượng
 */
const SYNONYM_GROUPS: string[][] = [
  ["black", "den", "đen", "blk"],
  ["white", "trang", "trắng", "wht"],
  ["gold", "vang", "vàng"],
  ["silver", "bac", "bạc", "slv"],
  ["gray", "grey", "xam", "xám"],
  ["blue", "xanh duong", "xanh dương", "xanh"],
  ["green", "xanh la", "xanh lá"],
  ["purple", "tim", "tím"],
  ["pink", "hong", "hồng"],
  ["orange", "cam"],
  ["yellow", "vang", "vàng"],
  ["titan", "titanium"],
  ["natural", "tu nhien", "tự nhiên"],
  ["desert", "sa mac", "sa mạc"]
];

/**
 * Mở rộng một từ thành danh sách các từ đồng nghĩa
 */
export const expandSynonyms = (word: string): string[] => {
  const wNorm = removeVietnameseTones(word);
  const synonyms = new Set<string>([word.toLowerCase(), wNorm]);

  for (const group of SYNONYM_GROUPS) {
    const hasMatch = group.some(
      (g) => g.toLowerCase() === word.toLowerCase() || removeVietnameseTones(g) === wNorm
    );
    if (hasMatch) {
      group.forEach((g) => {
        synonyms.add(g.toLowerCase());
        synonyms.add(removeVietnameseTones(g));
      });
    }
  }

  // Dung lượng (ví dụ: 256gb, 256g, 256, 1tb, 1t)
  const capMatch = word.match(/^(\d+)(gb|g|tb|t)?$/i);
  if (capMatch) {
    const num = capMatch[1];
    const unit = (capMatch[2] || "").toLowerCase();
    if (unit.startsWith("t") || (num === "1" && unit === "t") || (num === "2" && unit === "t")) {
      synonyms.add(`${num}tb`);
      synonyms.add(`${num}t`);
      synonyms.add(num);
    } else {
      synonyms.add(`${num}gb`);
      synonyms.add(`${num}g`);
      synonyms.add(num);
    }
  }

  return Array.from(synonyms).filter(Boolean);
};

export interface CandidateSearchOptions {
  query: string;
  isWholesale?: boolean;
}

/**
 * Tìm kiếm & xếp hạng thông minh các biến thể sản phẩm theo tên, SKU, thuộc tính
 */
export const searchAndRankVariants = async (
  query: string,
  options: { isWholesale?: boolean } = {}
): Promise<any[]> => {
  const qTrim = (query || "").trim();
  if (!qTrim) return [];

  const qLower = qTrim.toLowerCase();
  const qNoAccent = removeVietnameseTones(qLower);
  const tokens = qLower.split(/[\s,]+/).filter(Boolean);
  const tokensNoAccent = qNoAccent.split(/[\s,]+/).filter(Boolean);

  if (tokens.length === 0) return [];

  // Tìm kiếm ứng viên theo Tên sản phẩm hoặc SKU
  const strictRegex = new RegExp(escapeRegex(qTrim), "i");
  const flexSkuRegex = new RegExp(
    tokens.map((t) => escapeRegex(t)).join("[-_.\\s]*"),
    "i"
  );

  // Điều kiện tìm sản phẩm cha
  const productOrConditions: any[] = [
    { name: strictRegex },
    { sku: strictRegex },
    { search: strictRegex },
    { sku: flexSkuRegex }
  ];

  // Thêm các từ khóa độc lập (đặc biệt là 2 từ đầu, thường là model sp như "iphone", "17")
  tokens.forEach((t) => {
    if (t.length >= 2) {
      const r = new RegExp(escapeRegex(t), "i");
      productOrConditions.push({ name: r });
      productOrConditions.push({ search: r });
    }
  });

  const [matchedProducts, directSkuVariants] = await Promise.all([
    Product.find({
      deleted: { $ne: true },
      status: { $ne: "inactive" },
      $or: productOrConditions
    })
      .select("_id name slug inventoryType priceNew priceWholeSale images deleted status")
      .limit(100)
      .lean(),
    ProductVariant.find({
      status: { $ne: "inactive" },
      $or: [{ sku: strictRegex }, { sku: flexSkuRegex }]
    })
      .select("_id productId sku")
      .limit(60)
      .lean()
  ]);

  const candidateProductIds = Array.from(
    new Set([
      ...matchedProducts.map((p: any) => String(p._id)),
      ...directSkuVariants.map((v: any) => String(v.productId))
    ])
  ).map((id) => new mongoose.Types.ObjectId(id));

  if (candidateProductIds.length === 0) {
    return [];
  }

  // Lấy tất cả các biến thể đang active của các sản phẩm ứng viên
  const candidateVariants = await ProductVariant.find({
    productId: { $in: candidateProductIds },
    status: { $ne: "inactive" }
  })
    .populate("productId", "name slug inventoryType priceNew priceWholeSale status images deleted")
    .lean();

  const activeVariants = candidateVariants.filter(
    (v: any) =>
      v.productId &&
      !(v.productId as any).deleted &&
      (v.productId as any).status !== "inactive" &&
      v.status !== "inactive"
  );

  if (activeVariants.length === 0) {
    return [];
  }

  // 3. Lấy IMEI có sẵn
  const variantIds = activeVariants.map((v: any) => v._id);
  const availableImeiItems = await InventoryItem.find({
    variantId: { $in: variantIds },
    status: "available",
    deleted: false
  })
    .select("variantId identifier")
    .lean();

  const imeiMap = new Map<string, string[]>();
  for (const item of availableImeiItems) {
    const vId = String(item.variantId);
    if (!imeiMap.has(vId)) imeiMap.set(vId, []);
    if (item.identifier) imeiMap.get(vId)!.push(item.identifier);
  }

  // 4. Thuật toán chấm điểm và xếp hạng (Scoring & Ranking)
  const tokenSynonymSets = tokens.map((t) => expandSynonyms(t));

  const hasQueryPro = tokens.some((t) => t === "pro");
  const hasQueryMax = tokens.some((t) => t === "max" || t === "promax");
  const hasQueryPlus = tokens.some((t) => t === "plus");
  const hasQueryUltra = tokens.some((t) => t === "ultra");
  const hasQueryMini = tokens.some((t) => t === "mini");

  const scoredVariants: { variant: any; score: number; matchedTokenCount: number }[] = [];

  for (const v of activeVariants) {
    const prod = v.productId as any;
    const pName = (prod.name || "").toLowerCase();
    const pNameNoAccent = removeVietnameseTones(pName);
    const vSku = (v.sku || "").toLowerCase();
    const vSkuNoAccent = removeVietnameseTones(vSku);

    const attrValuesList = (v.attributeValue || []).map((a: any) =>
      `${a.value || ""} ${a.label || ""}`
    );
    const attrText = attrValuesList.join(" ").toLowerCase();
    const attrTextNoAccent = removeVietnameseTones(attrText);

    const fullText = `${pName} ${vSku} ${attrText}`;
    const fullTextNoAccent = `${pNameNoAccent} ${vSkuNoAccent} ${attrTextNoAccent}`;

    // Đếm số token khớp
    let matchedTokenCount = 0;
    for (const synList of tokenSynonymSets) {
      const tokenMatched = synList.some(
        (syn) =>
          fullText.includes(syn) ||
          fullTextNoAccent.includes(removeVietnameseTones(syn)) ||
          vSku.includes(syn)
      );
      if (tokenMatched) {
        matchedTokenCount++;
      }
    }

    // Nếu không khớp từ khóa nào thì bỏ qua
    if (matchedTokenCount === 0) continue;

    let score = matchedTokenCount * 1000;

    // A. Khớp chính xác SKU
    const cleanSku = vSku.replace(/[-_.\\s]/g, "");
    const cleanQuery = qLower.replace(/[-_.\\s]/g, "");
    if (cleanSku === cleanQuery) {
      score += 25000;
    } else if (vSku.includes(qLower) || flexSkuRegex.test(v.sku || "")) {
      score += 8000;
    }

    // B. Khớp tên sản phẩm
    if (pName === qLower || pNameNoAccent === qNoAccent) {
      score += 15000; // Trùng tuyệt đối tên sản phẩm (VD: tìm "iphone 17" và sp là "iPhone 17")
    } else if (pName.startsWith(qLower) || pNameNoAccent.startsWith(qNoAccent)) {
      score += 5000;
    } else if (pName.includes(qLower) || pNameNoAccent.includes(qNoAccent)) {
      score += 3000;
    }

    // C. PHẠT NẶNG NẾU SP CÓ CÁC TỪ MODIFIER (Pro, Max, Plus, Ultra, Mini) MÀ NGƯỜI DÙNG KHÔNG GÕ
    // Giải quyết triệt để lỗi: tìm "iphone 17" lại ra "iphone 17 pro" hay "iphone 17 pro max"
    const prodWords = pNameNoAccent.split(/[\s,]+/).filter(Boolean);
    const prodHasPro = prodWords.includes("pro");
    const prodHasMax = prodWords.includes("max");
    const prodHasPlus = prodWords.includes("plus");
    const prodHasUltra = prodWords.includes("ultra");
    const prodHasMini = prodWords.includes("mini");

    if (!hasQueryPro && prodHasPro) {
      score -= 3000;
    }
    if (!hasQueryMax && prodHasMax) {
      score -= 3500;
    }
    if (!hasQueryPlus && prodHasPlus) {
      score -= 2000;
    }
    if (!hasQueryUltra && prodHasUltra) {
      score -= 3000;
    }
    if (!hasQueryMini && prodHasMini) {
      score -= 1500;
    }

    // Ưu tiên sản phẩm có độ dài tên gần khớp với độ dài query
    const lenDiff = Math.abs(pName.length - qLower.length);
    score += Math.max(0, 500 - lenDiff * 15);

    // D. Ưu tiên biến thể còn tồn kho
    const vIdStr = String(v._id);
    const imeiList = imeiMap.get(vIdStr) || [];
    const invType = prod.inventoryType || "imei";
    const stock = invType === "imei" ? imeiList.length : Number(v.stock || 0);

    if (stock > 0) {
      score += 200;
    }

    scoredVariants.push({
      variant: v,
      score,
      matchedTokenCount
    });
  }

  if (scoredVariants.length === 0) return [];

  // Tìm số token khớp lớn nhất
  const maxMatched = Math.max(...scoredVariants.map((s) => s.matchedTokenCount));
  // Chỉ lấy các ứng viên có số token khớp bằng max hoặc tối thiểu (max - 1 nếu query >= 3 từ)
  const minRequiredTokens = tokens.length >= 3 ? Math.max(1, maxMatched - 1) : maxMatched;
  const filteredCandidates = scoredVariants.filter(
    (s) => s.matchedTokenCount >= minRequiredTokens
  );

  // Sắp xếp điểm số giảm dần
  filteredCandidates.sort((a, b) => b.score - a.score);

  // Format danh sách kết quả gửi về client
  const topVariants = filteredCandidates.slice(0, 35);

  const results = topVariants.map(({ variant }) => {
    const prod = variant.productId as any;
    const invType = prod.inventoryType || "imei";
    const vIdStr = String(variant._id);
    const imeiList = imeiMap.get(vIdStr) || [];
    const stock = invType === "imei" ? imeiList.length : Number(variant.stock || 0);

    const wholesalePrice = Number(
      variant.priceWholeSale && variant.priceWholeSale > 0
        ? variant.priceWholeSale
        : prod.priceWholeSale && prod.priceWholeSale > 0
          ? prod.priceWholeSale
          : variant.priceNew || prod.priceNew || 0
    );
    const retailPrice = Number(variant.priceNew || prod.priceNew || 0);

    return {
      variantId: variant._id,
      sku: variant.sku,
      productId: prod._id,
      productName: prod.name,
      inventoryType: invType,
      image: prod.images && prod.images[0] ? prod.images[0] : "",
      attributeValues: (variant.attributeValue || []).map((a: any) => ({
        label: a.label || a.value || "",
        value: a.value || ""
      })),
      unitPrice: options.isWholesale ? wholesalePrice : retailPrice,
      priceRetail: retailPrice,
      isWholesalePriced: Boolean(
        (variant.priceWholeSale && variant.priceWholeSale > 0) ||
        (prod.priceWholeSale && prod.priceWholeSale > 0)
      ),
      stock,
      availableIdentifiers: imeiList
    };
  });

  return results;
};
