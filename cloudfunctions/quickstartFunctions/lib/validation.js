const { BusinessError } = require("./errors");

function normalizeBarcode(value) {
  if (typeof value !== "string") {
    throw new BusinessError("INVALID_BARCODE", "条形码必须是字符串");
  }
  const barcode = value.trim();
  if (!barcode) throw new BusinessError("INVALID_BARCODE", "条形码不能为空");
  if (!/^[0-9]+$/.test(barcode)) {
    throw new BusinessError("INVALID_BARCODE", "条形码只能包含数字");
  }
  return barcode;
}

function validateProductInput(input = {}) {
  const name = String(input.name ?? "").trim();
  const priceInCents = input.priceInCents;
  const status = input.status === undefined ? "on_sale" : input.status;
  if (!name) throw new BusinessError("INVALID_NAME", "商品名称不能为空");
  if (typeof priceInCents !== "number" || !Number.isInteger(priceInCents) || priceInCents < 0) {
    throw new BusinessError("INVALID_PRICE", "价格必须是非负整数分");
  }
  if (!["on_sale", "off_sale"].includes(status)) {
    throw new BusinessError("INVALID_STATUS", "商品状态不合法");
  }
  return {
    barcode: normalizeBarcode(input.barcode),
    name,
    priceInCents,
    specification: String(input.specification ?? "").trim(),
    unit: String(input.unit ?? "").trim(),
    imageFileId: String(input.imageFileId ?? "").trim(),
    remark: String(input.remark ?? "").trim(),
    status
  };
}

module.exports = { normalizeBarcode, validateProductInput };
