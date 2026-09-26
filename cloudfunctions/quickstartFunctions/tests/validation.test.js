const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBarcode, validateProductInput } = require("../lib/validation");

test("normalizeBarcode preserves leading zeroes", () => {
  assert.equal(normalizeBarcode("0123456789012"), "0123456789012");
});

test("normalizeBarcode rejects blank values", () => {
  assert.throws(() => normalizeBarcode("  "), /条形码不能为空/);
});

test("normalizeBarcode rejects numeric values", () => {
  assert.throws(() => normalizeBarcode(123), /条形码必须是字符串/);
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

test("validateProductInput rejects blank, null, and non-number prices", () => {
  for (const priceInCents of ["", null, "350"]) {
    assert.throws(() => validateProductInput({
      barcode: "6901234567890",
      name: "商品",
      priceInCents,
      status: "on_sale"
    }), /价格必须是非负整数分/);
  }
});

test("validateProductInput rejects fractional cents", () => {
  assert.throws(() => validateProductInput({
    barcode: "6901234567890",
    name: "商品",
    priceInCents: 12.5,
    status: "on_sale"
  }), /价格必须是非负整数分/);
});

test("validateProductInput rejects invalid status", () => {
  assert.throws(() => validateProductInput({
    barcode: "6901234567890",
    name: "商品",
    priceInCents: 125,
    status: "deleted"
  }), /商品状态不合法/);
});

test("validateProductInput rejects explicitly blank status", () => {
  assert.throws(() => validateProductInput({
    barcode: "6901234567890",
    name: "商品",
    priceInCents: 125,
    status: ""
  }), /商品状态不合法/);
});
