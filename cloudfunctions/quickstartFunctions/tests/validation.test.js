const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBarcode, validateProductInput } = require("../lib/validation");

test("normalizeBarcode preserves leading zeroes", () => {
  assert.equal(normalizeBarcode("0123456789012"), "0123456789012");
});

test("normalizeBarcode rejects blank values", () => {
  assert.throws(() => normalizeBarcode("  "), /条形码不能为空/);
});

test("validateProductInput accepts integer cents", () => {
  assert.deepEqual(
    validateProductInput({
      barcode: "6901234567890",
      name: "可口可乐",
      priceInCents: 350,
      status: "on_sale"
    }),
    {
      barcode: "6901234567890",
      name: "可口可乐",
      priceInCents: 350,
      specification: "",
      unit: "",
      imageFileId: "",
      remark: "",
      status: "on_sale"
    }
  );
});

test("validateProductInput rejects fractional cents and invalid status", () => {
  assert.throws(() => validateProductInput({
    barcode: "6901234567890",
    name: "商品",
    priceInCents: 12.5,
    status: "deleted"
  }));
});
