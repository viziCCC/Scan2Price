const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductService } = require("../services/productService");
const { BusinessError } = require("../lib/errors");

function createFakeDb(initialProducts = []) {
  const products = initialProducts.map((product) => ({ ...product }));
  let nextId = products.length + 1;

  function matches(record, query) {
    return Object.entries(query).every(([key, expected]) => {
      if (expected && expected.__regexp) return expected.__regexp.test(String(record[key] || ""));
      return record[key] === expected;
    });
  }

  function makeQuery(filters = [], order = null, offset = 0, limit = null) {
    const query = {
      where(filter) {
        return makeQuery(filters.concat(filter), order, offset, limit);
      },
      orderBy(field, direction) {
        return makeQuery(filters, { field, direction }, offset, limit);
      },
      skip(count) {
        return makeQuery(filters, order, count, limit);
      },
      limit(count) {
        return makeQuery(filters, order, offset, count);
      },
      async get() {
        let rows = products.filter((record) => filters.every((filter) => matches(record, filter)));
        if (order) {
          const multiplier = order.direction === "asc" ? 1 : -1;
          rows = rows.slice().sort((left, right) => {
            const l = left[order.field] instanceof Date ? left[order.field].getTime() : left[order.field];
            const r = right[order.field] instanceof Date ? right[order.field].getTime() : right[order.field];
            return (l > r ? 1 : l < r ? -1 : 0) * multiplier;
          });
        }
        if (offset) rows = rows.slice(offset);
        if (limit !== null) rows = rows.slice(0, limit);
        return { data: rows.map((record) => ({ ...record })) };
      }
    };
    return query;
  }

  return {
    products,
    RegExp({ regexp, options = "" }) {
      return { __regexp: new RegExp(regexp, options) };
    },
    collection(name) {
      assert.equal(name, "products");
      return {
        ...makeQuery(),
        async add({ data }) {
          const _id = `p${nextId++}`;
          products.push({ _id, ...data });
          return { _id };
        },
        doc(id) {
          return {
            async update({ data }) {
              const record = products.find((product) => product._id === id);
              if (!record) throw new Error("missing product");
              Object.assign(record, data);
              return { stats: { updated: 1 } };
            }
          };
        }
      };
    }
  };
}

function fixture({ products = [], admin = false, now = () => new Date("2026-01-02T03:04:05.000Z") } = {}) {
  const db = createFakeDb(products);
  const authService = {
    async requireAdmin() {
      if (!admin) throw new BusinessError("FORBIDDEN", "无管理员权限");
      return { openid: "admin-1", isAdmin: true };
    }
  };
  return { service: createProductService({ db, authService, now }), db };
}

test("employee query returns only an on-sale product", async () => {
  const { service } = fixture({ products: [{ _id: "p1", barcode: "001", status: "on_sale", priceInCents: 350 }] });
  assert.equal((await service.getProductByBarcode({ barcode: "001" }))._id, "p1");
});

test("missing and off-sale products return distinct errors", async () => {
  const { service } = fixture({ products: [{ _id: "p1", barcode: "001", status: "off_sale" }] });
  await assert.rejects(() => service.getProductByBarcode({ barcode: "404" }), (error) => error.code === "PRODUCT_NOT_FOUND");
  await assert.rejects(() => service.getProductByBarcode({ barcode: "001" }), (error) => error.code === "PRODUCT_OFF_SALE");
});

test("including off-sale products requires an administrator", async () => {
  const normal = fixture({ products: [{ _id: "p1", barcode: "001", status: "off_sale" }] }).service;
  await assert.rejects(() => normal.getProductByBarcode({ barcode: "001", includeOffSale: true }), (error) => error.code === "FORBIDDEN");
  const admin = fixture({ admin: true, products: [{ _id: "p1", barcode: "001", status: "off_sale" }] }).service;
  assert.equal((await admin.getProductByBarcode({ barcode: "001", includeOffSale: true })).status, "off_sale");
});

test("createProduct rejects duplicate barcode and stores audit fields", async () => {
  const { service, db } = fixture({ admin: true, products: [{ _id: "p1", barcode: "001", status: "off_sale" }] });
  await assert.rejects(
    () => service.createProduct({ barcode: "001", name: "重复", priceInCents: 100 }),
    (error) => error.code === "DUPLICATE_BARCODE"
  );
  const result = await service.createProduct({ barcode: "002", name: "新品", priceInCents: 250, remark: "  促销  " });
  assert.equal(result.barcode, "002");
  const stored = db.products.find((product) => product._id === result._id);
  assert.deepEqual(stored, {
    _id: result._id,
    barcode: "002",
    name: "新品",
    priceInCents: 250,
    specification: "",
    unit: "",
    imageFileId: "",
    remark: "促销",
    status: "on_sale",
    createdBy: "admin-1",
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    updatedBy: "admin-1",
    updatedAt: new Date("2026-01-02T03:04:05.000Z")
  });
});

test("management writes require administrator permission", async () => {
  const service = fixture({ admin: false }).service;
  await assert.rejects(() => service.createProduct({ barcode: "001", name: "商品", priceInCents: 100 }), (error) => error.code === "FORBIDDEN");
  await assert.rejects(() => service.listProducts(), (error) => error.code === "FORBIDDEN");
  await assert.rejects(() => service.updateProduct({ productId: "p1", barcode: "001", name: "商品", priceInCents: 100 }), (error) => error.code === "FORBIDDEN");
  await assert.rejects(() => service.changeProductStatus({ productId: "p1", status: "off_sale" }), (error) => error.code === "FORBIDDEN");
});

test("updateProduct rejects duplicate barcode belonging to another product", async () => {
  const { service } = fixture({ admin: true, products: [
    { _id: "p1", barcode: "001", status: "on_sale" },
    { _id: "p2", barcode: "002", status: "on_sale" }
  ] });
  await assert.rejects(
    () => service.updateProduct({ productId: "p1", barcode: "002", name: "商品", priceInCents: 100 }),
    (error) => error.code === "DUPLICATE_BARCODE"
  );
});

test("listProducts filters, searches and caps pagination", async () => {
  const { service } = fixture({ admin: true, products: [
    { _id: "p1", barcode: "001", name: "苹果", status: "on_sale", updatedAt: new Date("2026-01-01") },
    { _id: "p2", barcode: "002", name: "香蕉", status: "off_sale", updatedAt: new Date("2026-01-02") },
    { _id: "p3", barcode: "003", name: "青苹果", status: "on_sale", updatedAt: new Date("2026-01-03") }
  ] });
  const byName = await service.listProducts({ keyword: "苹果", status: "on_sale", page: 1, pageSize: 1 });
  assert.deepEqual({ ids: byName.items.map((item) => item._id), page: byName.page, pageSize: byName.pageSize }, { ids: ["p3"], page: 1, pageSize: 1 });
  const byBarcode = await service.listProducts({ keyword: "002", status: "", pageSize: 99 });
  assert.deepEqual(byBarcode.items.map((item) => item._id), ["p2"]);
  assert.equal(byBarcode.pageSize, 50);
});

test("changeProductStatus updates status and audit fields without deleting", async () => {
  const { service, db } = fixture({ admin: true, products: [{ _id: "p1", barcode: "001", status: "on_sale" }] });
  const result = await service.changeProductStatus({ productId: "p1", status: "off_sale" });
  assert.deepEqual(result, { productId: "p1", status: "off_sale" });
  assert.equal(db.products.length, 1);
  assert.equal(db.products[0].status, "off_sale");
  assert.equal(db.products[0].updatedBy, "admin-1");
  await assert.rejects(() => service.changeProductStatus({ productId: "p1", status: "deleted" }), (error) => error.code === "INVALID_STATUS");
});
