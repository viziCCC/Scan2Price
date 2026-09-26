const test = require("node:test");
const assert = require("node:assert/strict");
const { addItem, changeQuantity, removeItem, summarize } = require("../miniprogram/utils/cart");
const product = { _id: "p1", barcode: "001", name: "商品", priceInCents: 350 };
test("duplicate scan increments quantity", () => assert.equal(addItem(addItem([], product), product)[0].quantity, 2));
test("quantity cannot fall below one", () => assert.equal(changeQuantity(addItem([], product), "p1", -1)[0].quantity, 1));
test("summary uses integer cents", () => assert.deepEqual(summarize([{ ...product, productId: "p1", quantity: 3 }]), { totalQuantity: 3, totalInCents: 1050 }));
test("remove item", () => assert.equal(removeItem([{ productId: "p1" }, { productId: "p2" }], "p1")[0].productId, "p2"));
