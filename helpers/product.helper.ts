export const formatProductItem = (item: any) => {
  // Giảm giá
  item.discount = Math.floor(((item.priceOld - item.priceNew) / item.priceOld) * 100);

  // Màu sắc
  const colorSet = new Set();
  item.variants
    .filter((variant: any) => variant.status)
    .forEach((variant: any) => {
      variant.attributeValue.forEach((attr: any) => {
        if(attr.attrType == "color") {
          colorSet.add(attr.value);
        }
      })
    })
  item.colorList = [...colorSet];
}