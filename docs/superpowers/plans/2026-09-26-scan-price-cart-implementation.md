# 扫码查价与价格清单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有微信云开发 QuickStart 改造成商铺内部扫码查价工具，支持管理员维护自建商品库、员工连续扫码并使用临时价格清单计算总价。

**Architecture:** 继续使用一个 `quickstartFunctions` 云函数入口，通过 `event.type` 分发到独立的权限与商品服务模块；所有管理写操作在云函数内部校验管理员 OpenID。小程序以首页、价格清单、商品管理列表和商品编辑页组成，价格清单存放在 `App.globalData` 内存中，金额统一使用整数分计算。

**Tech Stack:** 微信小程序原生 JavaScript/WXML/WXSS、微信云开发、`wx-server-sdk ~2.4.0`、CommonJS、Node.js 内置 `node:test` 与 `assert`。

**Spec:** `docs/superpowers/specs/2026-09-26-scan-price-cart-design.md`

## Global Constraints

- 条形码始终按字符串处理，不能转换为数字。
- 商品价格以整数分存储和计算，页面展示时转换为元并保留两位小数。
- 商品数量只允许大于或等于 `1` 的整数。
- 价格清单只存在当前小程序运行内存中，不写入 Storage 或云数据库。
- 普通员工只可查询商品；所有管理接口必须在云函数中校验 `admins` 集合。
- 商品不物理删除，只允许 `on_sale` 和 `off_sale` 两种状态。
- 第一版不实现库存、订单、支付、顾客账号、第三方商品接口和管理员管理页面。
- 当前目录没有 Git 仓库；执行计划时先建立基线提交，之后每个任务独立提交。
- `miniprogram/app.js` 的云环境 ID 必须由维护者填入实际微信云开发环境 ID，计划不能虚构该值。

---

## Planned File Structure

```text
Scan2Price/
├─ package.json                              # 本地纯逻辑测试入口
├─ tests/
│  └─ cart.test.js                          # 价格清单纯函数测试
├─ cloudfunctions/quickstartFunctions/
│  ├─ index.js                              # 云函数 action 路由和统一错误返回
│  ├─ lib/
│  │  ├─ errors.js                          # 业务错误类型与错误码
│  │  └─ validation.js                      # 条码和商品表单校验
│  ├─ services/
│  │  ├─ authService.js                     # OpenID 与管理员校验
│  │  └─ productService.js                  # 商品查询、新增、编辑、上下架
│  └─ tests/
│     ├─ validation.test.js
│     ├─ authService.test.js
│     └─ productService.test.js
└─ miniprogram/
   ├─ app.js                                # 云初始化、当前用户和内存清单
   ├─ app.json                              # 页面、tabBar 和标题注册
   ├─ app.wxss                              # 全局颜色、按钮和表单基础样式
   ├─ utils/
   │  ├─ cloudApi.js                        # wx.cloud.callFunction Promise 封装
   │  ├─ cart.js                            # 价格清单纯函数
   │  ├─ money.js                           # 分/元显示转换
   │  └─ scan.js                            # wx.scanCode 条码结果规范化
   └─ pages/
      ├─ index/                             # 扫码查价首页（替换 QuickStart）
      ├─ cart/                              # 临时价格清单
      ├─ products/                          # 管理员商品列表
      └─ product-edit/                      # 管理员新增/编辑商品
```

---

### Task 1: Establish Git Baseline and Test Harness

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `cloudfunctions/quickstartFunctions/tests/validation.test.js`
- Create: `cloudfunctions/quickstartFunctions/lib/errors.js`
- Create: `cloudfunctions/quickstartFunctions/lib/validation.js`

**Interfaces:**
- Produces: `BusinessError(code, message, details?)`
- Produces: `normalizeBarcode(value): string`
- Produces: `validateProductInput(input): ProductInput`

- [ ] **Step 1: Initialize Git and create the baseline commit**

Run from `E:\myWork\Scan2Price`:

```powershell
git init
git add .
git commit -m "chore: capture quickstart baseline and approved design"
```

Expected: `git status --short` returns no output. If Git user identity is not configured, configure repository-local `user.name` and `user.email`, then rerun the commit.

- [ ] **Step 2: Add root test command and ignore generated dependencies**

Create `.gitignore`:

```gitignore
node_modules/
cloudfunctions/*/node_modules/
miniprogram_npm/
.DS_Store
*.log
```

Create root `package.json`:

```json
{
  "name": "scan2price",
  "private": true,
  "scripts": {
    "test": "node --test tests/cart.test.js cloudfunctions/quickstartFunctions/tests/validation.test.js cloudfunctions/quickstartFunctions/tests/authService.test.js cloudfunctions/quickstartFunctions/tests/productService.test.js"
  }
}
```

- [ ] **Step 3: Write failing validation tests**

Create `cloudfunctions/quickstartFunctions/tests/validation.test.js`:

```js
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
```

- [ ] **Step 4: Run the validation tests and confirm failure**

Run:

```powershell
node --test cloudfunctions/quickstartFunctions/tests/validation.test.js
```

Expected: FAIL with `Cannot find module '../lib/validation'`.

- [ ] **Step 5: Implement business errors and validation**

Create `cloudfunctions/quickstartFunctions/lib/errors.js`:

```js
class BusinessError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
    this.details = details;
  }
}

module.exports = { BusinessError };
```

Create `cloudfunctions/quickstartFunctions/lib/validation.js`:

```js
const { BusinessError } = require("./errors");

function normalizeBarcode(value) {
  const barcode = String(value ?? "").trim();
  if (!barcode) throw new BusinessError("INVALID_BARCODE", "条形码不能为空");
  if (!/^[0-9]+$/.test(barcode)) {
    throw new BusinessError("INVALID_BARCODE", "条形码只能包含数字");
  }
  return barcode;
}

function validateProductInput(input = {}) {
  const name = String(input.name ?? "").trim();
  const priceInCents = Number(input.priceInCents);
  const status = input.status || "on_sale";
  if (!name) throw new BusinessError("INVALID_NAME", "商品名称不能为空");
  if (!Number.isInteger(priceInCents) || priceInCents < 0) {
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
```

- [ ] **Step 6: Run tests and commit**

Run: `node --test cloudfunctions/quickstartFunctions/tests/validation.test.js`

Expected: 4 tests PASS.

```powershell
git add .gitignore package.json cloudfunctions/quickstartFunctions/lib cloudfunctions/quickstartFunctions/tests/validation.test.js
git commit -m "test: add product validation harness"
```

---

### Task 2: Implement Administrator Authorization

**Files:**
- Create: `cloudfunctions/quickstartFunctions/services/authService.js`
- Create: `cloudfunctions/quickstartFunctions/tests/authService.test.js`

**Interfaces:**
- Consumes: `BusinessError` from Task 1
- Produces: `createAuthService({ db, getOpenId }): { getCurrentUser, requireAdmin }`
- Produces: `getCurrentUser(): Promise<{ openid: string, isAdmin: boolean }>`
- Produces: `requireAdmin(): Promise<{ openid: string, isAdmin: true }>`

- [ ] **Step 1: Write failing authorization tests with a fake database**

Create `cloudfunctions/quickstartFunctions/tests/authService.test.js` with a local `createFakeDb(admins)` whose `collection("admins").where(query).limit(1).get()` resolves to matching records. Add these tests:

```js
test("getCurrentUser identifies an enabled administrator", async () => {
  const service = createAuthService({
    db: createFakeDb([{ openid: "admin-1", enabled: true }]),
    getOpenId: () => "admin-1"
  });
  assert.deepEqual(await service.getCurrentUser(), { openid: "admin-1", isAdmin: true });
});

test("requireAdmin rejects a normal employee", async () => {
  const service = createAuthService({ db: createFakeDb([]), getOpenId: () => "staff-1" });
  await assert.rejects(() => service.requireAdmin(), error => error.code === "FORBIDDEN");
});
```

- [ ] **Step 2: Run tests and confirm the missing module failure**

Run: `node --test cloudfunctions/quickstartFunctions/tests/authService.test.js`

Expected: FAIL with `Cannot find module '../services/authService'`.

- [ ] **Step 3: Implement the authorization service**

Create `cloudfunctions/quickstartFunctions/services/authService.js`:

```js
const { BusinessError } = require("../lib/errors");

function createAuthService({ db, getOpenId }) {
  async function getCurrentUser() {
    const openid = getOpenId();
    const result = await db.collection("admins")
      .where({ openid, enabled: true })
      .limit(1)
      .get();
    return { openid, isAdmin: result.data.length > 0 };
  }

  async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user.isAdmin) throw new BusinessError("FORBIDDEN", "无管理员权限");
    return user;
  }

  return { getCurrentUser, requireAdmin };
}

module.exports = { createAuthService };
```

- [ ] **Step 4: Run tests and commit**

Run: `node --test cloudfunctions/quickstartFunctions/tests/authService.test.js`

Expected: all authorization tests PASS.

```powershell
git add cloudfunctions/quickstartFunctions/services/authService.js cloudfunctions/quickstartFunctions/tests/authService.test.js
git commit -m "feat: add administrator authorization service"
```

---

### Task 3: Implement Product Service and Cloud Function Routing

**Files:**
- Create: `cloudfunctions/quickstartFunctions/services/productService.js`
- Create: `cloudfunctions/quickstartFunctions/tests/productService.test.js`
- Modify: `cloudfunctions/quickstartFunctions/index.js`
- Modify: `cloudfunctions/quickstartFunctions/package.json`

**Interfaces:**
- Consumes: `normalizeBarcode`, `validateProductInput`, `requireAdmin()`
- Produces: `createProductService({ db, authService, now }): ProductService`
- Cloud actions: `getCurrentUser`, `getProductByBarcode`, `listProducts`, `createProduct`, `updateProduct`, `changeProductStatus`
- Unified response: `{ success: true, data }` or `{ success: false, error: { code, message, details } }`

- [ ] **Step 1: Write product service tests**

Create an in-memory fake `products` collection supporting `where`, `limit`, `skip`, `orderBy`, `get`, `add`, and `doc(id).update`. Test at minimum:

```js
test("employee query returns only an on-sale product", async () => {
  const service = createProductService(fixture({
    products: [{ _id: "p1", barcode: "001", status: "on_sale", priceInCents: 350 }]
  }));
  assert.equal((await service.getProductByBarcode({ barcode: "001" }))._id, "p1");
});

test("createProduct rejects duplicate barcode", async () => {
  const service = createProductService(fixture({
    products: [{ _id: "p1", barcode: "001", status: "off_sale" }],
    admin: true
  }));
  await assert.rejects(
    () => service.createProduct({ barcode: "001", name: "重复", priceInCents: 100 }),
    error => error.code === "DUPLICATE_BARCODE"
  );
});

test("management writes require administrator permission", async () => {
  const service = createProductService(fixture({ admin: false }));
  await assert.rejects(
    () => service.changeProductStatus({ productId: "p1", status: "off_sale" }),
    error => error.code === "FORBIDDEN"
  );
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test cloudfunctions/quickstartFunctions/tests/productService.test.js`

Expected: FAIL because `productService.js` does not exist.

- [ ] **Step 3: Implement product service methods**

Create `productService.js` with these exact methods:

```js
function createProductService({ db, authService, now = () => new Date() }) {
  async function findByBarcode(barcode) {
    const result = await db.collection("products").where({ barcode }).limit(1).get();
    return result.data[0] || null;
  }

  async function getProductByBarcode({ barcode, includeOffSale = false }) {
    const normalized = normalizeBarcode(barcode);
    if (includeOffSale) await authService.requireAdmin();
    const product = await findByBarcode(normalized);
    if (!product) throw new BusinessError("PRODUCT_NOT_FOUND", "商品未录入");
    if (!includeOffSale && product.status !== "on_sale") {
      throw new BusinessError("PRODUCT_OFF_SALE", "商品已下架");
    }
    return product;
  }

  async function createProduct(input) {
    const admin = await authService.requireAdmin();
    const product = validateProductInput(input);
    if (await findByBarcode(product.barcode)) {
      throw new BusinessError("DUPLICATE_BARCODE", "条形码已存在");
    }
    const timestamp = now();
    const result = await db.collection("products").add({
      data: { ...product, createdBy: admin.openid, createdAt: timestamp, updatedBy: admin.openid, updatedAt: timestamp }
    });
    return { _id: result._id, ...product };
  }
```

Add the remaining methods explicitly:

```js
async function listProducts({ keyword = "", status = "", page = 1, pageSize = 20 }) {
  await authService.requireAdmin();
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 20));
  const where = {};
  if (["on_sale", "off_sale"].includes(status)) where.status = status;
  const normalizedKeyword = String(keyword).trim();
  if (normalizedKeyword && /^[0-9]+$/.test(normalizedKeyword)) where.barcode = normalizedKeyword;

  let query = db.collection("products").where(where);
  if (normalizedKeyword && !where.barcode) {
    query = query.where({ name: db.RegExp({ regexp: normalizedKeyword, options: "i" }) });
  }
  const result = await query.orderBy("updatedAt", "desc")
    .skip((safePage - 1) * safePageSize)
    .limit(safePageSize)
    .get();
  return { items: result.data, page: safePage, pageSize: safePageSize };
}

async function updateProduct(input) {
  const admin = await authService.requireAdmin();
  const productId = String(input.productId || "").trim();
  if (!productId) throw new BusinessError("INVALID_PRODUCT_ID", "商品 ID 不能为空");
  const product = validateProductInput(input);
  const duplicate = await findByBarcode(product.barcode);
  if (duplicate && duplicate._id !== productId) {
    throw new BusinessError("DUPLICATE_BARCODE", "条形码已存在");
  }
  await db.collection("products").doc(productId).update({
    data: { ...product, updatedBy: admin.openid, updatedAt: now() }
  });
  return { _id: productId, ...product };
}

async function changeProductStatus({ productId, status }) {
  const admin = await authService.requireAdmin();
  if (!["on_sale", "off_sale"].includes(status)) {
    throw new BusinessError("INVALID_STATUS", "商品状态不合法");
  }
  await db.collection("products").doc(String(productId)).update({
    data: { status, updatedBy: admin.openid, updatedAt: now() }
  });
  return { productId: String(productId), status };
}

return {
  getProductByBarcode,
  listProducts,
  createProduct,
  updateProduct,
  changeProductStatus
};
```

- [ ] **Step 4: Replace the QuickStart cloud entry with explicit routing**

Update `index.js` to initialize services and route only supported actions:

```js
const cloud = require("wx-server-sdk");
const { BusinessError } = require("./lib/errors");
const { createAuthService } = require("./services/authService");
const { createProductService } = require("./services/productService");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const authService = createAuthService({
  db,
  getOpenId: () => cloud.getWXContext().OPENID
});
const productService = createProductService({ db, authService });

const handlers = {
  getCurrentUser: () => authService.getCurrentUser(),
  getProductByBarcode: event => productService.getProductByBarcode(event.data || {}),
  listProducts: event => productService.listProducts(event.data || {}),
  createProduct: event => productService.createProduct(event.data || {}),
  updateProduct: event => productService.updateProduct(event.data || {}),
  changeProductStatus: event => productService.changeProductStatus(event.data || {})
};

exports.main = async event => {
  try {
    const handler = handlers[event.type];
    if (!handler) throw new BusinessError("UNKNOWN_ACTION", "不支持的操作");
    return { success: true, data: await handler(event) };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.code ? error.message : "服务暂时不可用",
        details: error.details || null
      }
    };
  }
};
```

- [ ] **Step 5: Update cloud package test script and run all cloud tests**

Set `cloudfunctions/quickstartFunctions/package.json` script to:

```json
"test": "node --test tests/validation.test.js tests/authService.test.js tests/productService.test.js"
```

Run: `npm test --prefix cloudfunctions/quickstartFunctions`

Expected: all cloud tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add cloudfunctions/quickstartFunctions
git commit -m "feat: add secured product cloud APIs"
```

---

### Task 4: Add Shared Mini Program Utilities and In-Memory Cart Logic

**Files:**
- Create: `miniprogram/utils/cloudApi.js`
- Create: `miniprogram/utils/cart.js`
- Create: `miniprogram/utils/money.js`
- Create: `miniprogram/utils/scan.js`
- Create: `tests/cart.test.js`
- Modify: `miniprogram/app.js`

**Interfaces:**
- Produces: `callCloud(type, data): Promise<any>`
- Produces: `addItem(items, product): CartItem[]`, `changeQuantity(items, productId, delta): CartItem[]`, `removeItem(items, productId): CartItem[]`, `summarize(items): { totalQuantity, totalInCents }`
- Produces: `formatCents(cents): string`
- Produces: `scanBarcode(): Promise<string | null>`
- App state: `globalData.currentUser`, `globalData.cartItems`

- [ ] **Step 1: Write failing cart tests**

Create `tests/cart.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { addItem, changeQuantity, removeItem, summarize } = require("../miniprogram/utils/cart");

const product = { _id: "p1", barcode: "001", name: "商品", priceInCents: 350 };

test("adding the same product increments quantity", () => {
  const once = addItem([], product);
  const twice = addItem(once, product);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].quantity, 2);
});

test("quantity never falls below one", () => {
  const items = addItem([], product);
  assert.deepEqual(changeQuantity(items, "p1", -1), items);
});

test("summary uses integer cents", () => {
  const items = [{ ...product, productId: "p1", quantity: 3 }];
  assert.deepEqual(summarize(items), { totalQuantity: 3, totalInCents: 1050 });
});

test("removeItem removes only the selected product", () => {
  const items = [{ ...product, productId: "p1", quantity: 1 }, { ...product, productId: "p2", quantity: 1 }];
  assert.deepEqual(removeItem(items, "p1").map(item => item.productId), ["p2"]);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/cart.test.js`

Expected: FAIL because `miniprogram/utils/cart.js` does not exist.

- [ ] **Step 3: Implement cart and money utilities**

Implement immutable cart operations:

```js
function addItem(items, product) {
  const productId = product._id;
  const existing = items.find(item => item.productId === productId);
  if (existing) {
    return items.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
  }
  return [...items, {
    productId,
    barcode: product.barcode,
    name: product.name,
    specification: product.specification || "",
    unit: product.unit || "",
    priceInCents: product.priceInCents,
    quantity: 1
  }];
}

function changeQuantity(items, productId, delta) {
  return items.map(item => {
    if (item.productId !== productId) return item;
    return { ...item, quantity: Math.max(1, item.quantity + delta) };
  });
}

function summarize(items) {
  return items.reduce((total, item) => ({
    totalQuantity: total.totalQuantity + item.quantity,
    totalInCents: total.totalInCents + item.priceInCents * item.quantity
  }), { totalQuantity: 0, totalInCents: 0 });
}
```

`formatCents` returns `(Number(cents) / 100).toFixed(2)`.

- [ ] **Step 4: Implement cloud and scan wrappers**

`cloudApi.js` unwraps the unified cloud response and rejects with an `Error` carrying `code`:

```js
async function callCloud(type, data = {}) {
  const response = await wx.cloud.callFunction({ name: "quickstartFunctions", data: { type, data } });
  const result = response.result;
  if (!result || !result.success) {
    const error = new Error(result?.error?.message || "服务暂时不可用");
    error.code = result?.error?.code || "NETWORK_ERROR";
    throw error;
  }
  return result.data;
}
module.exports = { callCloud };
```

`scan.js` wraps `wx.scanCode({ scanType: ["barCode"] })`; return trimmed `result` on success, return `null` when `errMsg` contains `cancel`, and rethrow other failures.

- [ ] **Step 5: Update app state and current-user loading**

Replace the existing `App` definition so `globalData` is declared at the root and remains available across pages:

```js
App({
  globalData: {
    env: "",
    currentUser: null,
    cartItems: []
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上基础库以使用云能力");
      return;
    }
    wx.cloud.init({ env: this.globalData.env, traceUser: true });
  },

  async loadCurrentUser() {
    const { callCloud } = require("./utils/cloudApi");
    const currentUser = await callCloud("getCurrentUser");
    this.globalData.currentUser = currentUser;
    return currentUser;
  }
});
```

Do not add `wx.setStorageSync` or `wx.getStorageSync`.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`

Expected: cart and cloud-domain tests PASS.

```powershell
git add package.json tests miniprogram/utils miniprogram/app.js
git commit -m "feat: add in-memory pricing cart utilities"
```

---

### Task 5: Replace QuickStart with the Scan Price Home Page

**Files:**
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/pages/index/index.json`
- Modify: `miniprogram/app.wxss`

**Interfaces:**
- Consumes: `scanBarcode`, `callCloud`, `addItem`, `formatCents`, `App.globalData.currentUser`, `App.globalData.cartItems`
- Produces page handlers: `handleScan`, `handleManualSearch`, `searchBarcode`, `addCurrentProduct`, `openCart`, `openProductManagement`

- [ ] **Step 1: Replace page data and lifecycle logic**

Use this state shape in `index.js`:

```js
data: {
  barcodeInput: "",
  product: null,
  displayPrice: "0.00",
  loading: false,
  isAdmin: false,
  cartQuantity: 0
}
```

In `onShow`, read `getApp().globalData.cartItems`, calculate total quantity with `summarize`, and call `app.loadCurrentUser()` only when current user has not been loaded.

- [ ] **Step 2: Implement scan and manual query handlers**

```js
async handleScan() {
  const barcode = await scanBarcode();
  if (barcode) await this.searchBarcode(barcode);
},

async searchBarcode(barcode) {
  this.setData({ loading: true, product: null });
  try {
    const product = await callCloud("getProductByBarcode", { barcode });
    this.setData({ product, barcodeInput: barcode, displayPrice: formatCents(product.priceInCents) });
  } catch (error) {
    const content = error.code === "PRODUCT_NOT_FOUND" ? "商品未录入" :
      error.code === "PRODUCT_OFF_SALE" ? "商品已下架" : error.message;
    wx.showModal({ title: "查询失败", content, showCancel: false });
  } finally {
    this.setData({ loading: false });
  }
}
```

For an administrator receiving `PRODUCT_NOT_FOUND`, show a second action “录入商品”; navigate to `/pages/product-edit/index?barcode=${encodeURIComponent(barcode)}` when confirmed.

- [ ] **Step 3: Implement add-to-cart and navigation**

`addCurrentProduct` must call `addItem`, assign the returned array to `app.globalData.cartItems`, refresh `cartQuantity`, and show `wx.showToast({ title: "已加入价格清单" })`. Navigation uses `wx.switchTab` for `/pages/cart/index` and `wx.navigateTo` for `/pages/products/index`.

- [ ] **Step 4: Build the WXML layout**

The page contains, in order:

1. Title “扫码查价”。
2. Administrator-only “商品管理” link guarded by `wx:if="{{isAdmin}}"`.
3. Large primary “扫码查价” button.
4. Manual barcode input and query button.
5. Query result card with name, specification/unit, barcode, `¥{{displayPrice}}`, and “加入价格清单”。
6. A cart summary button showing `价格清单（{{cartQuantity}} 件）`.

- [ ] **Step 5: Apply focused styles and remove QuickStart component dependency**

Remove `cloud-tip-modal` from `index.json`. Add reusable global classes for `.page`, `.card`, `.primary-button`, `.secondary-button`, `.field`, and `.price`. Keep touch targets at least `88rpx` high and use the existing PingFang/WeChat visual style.

- [ ] **Step 6: Manually verify and commit**

In WeChat Developer Tools:

- Compile with a configured cloud environment.
- Cancel scan: page remains unchanged and no error modal appears.
- Manually query an existing product: result card shows correct `¥0.00` formatting.
- Add product twice: cart badge increments to `2`.
- Log in with a non-admin OpenID: product management link is absent.

```powershell
git add miniprogram/pages/index miniprogram/app.wxss
git commit -m "feat: build scan price home page"
```

---

### Task 6: Build the Temporary Pricing List Page

**Files:**
- Create: `miniprogram/pages/cart/index.js`
- Create: `miniprogram/pages/cart/index.wxml`
- Create: `miniprogram/pages/cart/index.wxss`
- Create: `miniprogram/pages/cart/index.json`
- Modify: `miniprogram/app.json`

**Interfaces:**
- Consumes: `scanBarcode`, `callCloud`, cart utility functions, `formatCents`, `App.globalData.cartItems`
- Produces handlers: `scanAndAdd`, `increaseQuantity`, `decreaseQuantity`, `removeItem`, `clearCart`

- [ ] **Step 1: Register the cart page and tab bar**

Update `app.json` pages to include `pages/cart/index`, `pages/products/index`, and `pages/product-edit/index`. Configure a two-item `tabBar`:

```json
{
  "color": "#777777",
  "selectedColor": "#07c160",
  "list": [
    { "pagePath": "pages/index/index", "text": "扫码查价", "iconPath": "images/icons/home.png", "selectedIconPath": "images/icons/home-active.png" },
    { "pagePath": "pages/cart/index", "text": "价格清单", "iconPath": "images/icons/goods.png", "selectedIconPath": "images/icons/goods-active.png" }
  ]
}
```

Set navigation title to “扫码核价”。

- [ ] **Step 2: Implement cart page projection and actions**

`refresh()` reads global cart items and maps each item to presentation data containing `displayPrice` and `displaySubtotal`, then sets `totalQuantity` and `displayTotal`.

`decreaseQuantity` behavior:

```js
if (item.quantity === 1) {
  const confirm = await showConfirm("数量已经是 1，是否移除该商品？");
  if (!confirm) return;
  app.globalData.cartItems = removeItem(items, productId);
} else {
  app.globalData.cartItems = changeQuantity(items, productId, -1);
}
this.refresh();
```

`clearCart` requires confirmation, then assigns `[]` to `app.globalData.cartItems`.

- [ ] **Step 3: Implement continuous scan from the cart page**

`scanAndAdd` calls `scanBarcode`, queries `getProductByBarcode`, applies `addItem`, refreshes the page, and shows the toast “已添加，可继续扫码”. It remains on the cart page. For `PRODUCT_NOT_FOUND` and `PRODUCT_OFF_SALE`, show distinct modal messages and preserve existing items.

- [ ] **Step 4: Build cart WXML and WXSS**

Render a sticky top “扫码添加” button, empty-state card when `items.length === 0`, one card per item with `- / quantity / +`, item subtotal, remove action, and a fixed or sticky footer with total quantity, total amount, and clear button. Use `data-product-id` on all row actions.

- [ ] **Step 5: Verify cart behavior and commit**

Manual cases:

- Scan A, scan B, scan A: two rows and A quantity `2`.
- Increase/decrease values: totals update immediately.
- Decrease quantity `1`: confirmation appears before removal.
- Clear: confirmation appears and empty state renders.
- Kill and restart the mini program: list is empty.

Run: `npm test`

Expected: all automated tests PASS.

```powershell
git add miniprogram/app.json miniprogram/pages/cart
git commit -m "feat: add temporary pricing list page"
```

---

### Task 7: Build Administrator Product List

**Files:**
- Create: `miniprogram/pages/products/index.js`
- Create: `miniprogram/pages/products/index.wxml`
- Create: `miniprogram/pages/products/index.wxss`
- Create: `miniprogram/pages/products/index.json`

**Interfaces:**
- Consumes: `callCloud("listProducts")`, `scanBarcode`, `App.globalData.currentUser`
- Produces handlers: `loadProducts`, `search`, `changeStatusFilter`, `scanToCreateOrEdit`, `openManualCreate`, `openEdit`

- [ ] **Step 1: Add page-level administrator guard**

In `onLoad`, call `app.loadCurrentUser()` when needed. If `isAdmin` is false, show `wx.showModal({ title: "无权限", content: "该页面仅管理员可用", showCancel: false })` and call `wx.navigateBack()` after confirmation. This is usability protection; cloud functions remain the security boundary.

- [ ] **Step 2: Implement paginated search and status filters**

Use page data:

```js
{ keyword: "", status: "on_sale", items: [], page: 1, pageSize: 20, loading: false }
```

`loadProducts` calls `listProducts` with those values. Search resets page to `1`. Status buttons select `on_sale`, `off_sale`, or empty string for all. Display prices via `formatCents`.

- [ ] **Step 3: Implement scan-first creation flow**

After scanning, call `getProductByBarcode` with `{ barcode, includeOffSale: true }`. If found, navigate with ``wx.navigateTo({ url: `/pages/product-edit/index?id=${product._id}` })``. If error code is `PRODUCT_NOT_FOUND`, navigate with ``wx.navigateTo({ url: `/pages/product-edit/index?barcode=${encodeURIComponent(barcode)}` })``. Other errors display a modal.

- [ ] **Step 4: Build list UI**

Include search input, three status filters, prominent “扫码录入”, secondary “手动录入”, product cards showing name, barcode, specification/unit, price, and status tag. Tapping a card opens edit. Add `onPullDownRefresh` to reload and stop refresh in `finally`.

- [ ] **Step 5: Verify and commit**

Manual cases:

- Ordinary employee opening the URL directly is returned to the previous page.
- Administrator filters and searches products.
- Scanning an existing on-sale or off-sale barcode opens edit.
- Scanning an unknown barcode opens create with barcode prefilled.

```powershell
git add miniprogram/pages/products
git commit -m "feat: add administrator product list"
```

---

### Task 8: Build Product Create and Edit Form

**Files:**
- Create: `miniprogram/pages/product-edit/index.js`
- Create: `miniprogram/pages/product-edit/index.wxml`
- Create: `miniprogram/pages/product-edit/index.wxss`
- Create: `miniprogram/pages/product-edit/index.json`

**Interfaces:**
- Consumes: `callCloud`, `scanBarcode`, `formatCents`
- Produces handlers: `scanBarcode`, `loadProduct`, `chooseImage`, `submit`, `changeStatus`

- [ ] **Step 1: Implement create/edit mode initialization**

Read `options.id` and `options.barcode`. In edit mode, query the product through a new cloud action `getProductById` restricted to administrators; add that method to `productService`, route it in `index.js`, and add a service test proving ordinary employees receive `FORBIDDEN`. In create mode, initialize the form with the supplied barcode and `status: "on_sale"`.

- [ ] **Step 2: Implement form conversion and client validation**

The visible price field uses yuan text. Convert to cents without binary rounding drift:

```js
function yuanTextToCents(value) {
  const match = String(value).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("请输入正确价格，最多两位小数");
  return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
}
```

Validate non-empty barcode, non-empty name, valid price, and numeric barcode before calling the cloud function. Keep server validation authoritative. Add unit tests for `yuanTextToCents` by extracting it to `miniprogram/utils/money.js` and extending `tests/cart.test.js` with `3`, `3.5`, `3.50`, `0.01`, and invalid `3.456` cases.

- [ ] **Step 3: Implement optional image upload**

Use `wx.chooseMedia({ count: 1, mediaType: ["image"] })`, then upload to a deterministic unique path:

```js
const extension = tempFilePath.split(".").pop() || "jpg";
const cloudPath = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
const upload = await wx.cloud.uploadFile({ cloudPath, filePath: tempFilePath });
this.setData({ "form.imageFileId": upload.fileID });
```

If upload fails, preserve all form fields and allow retry.

- [ ] **Step 4: Submit through createProduct or updateProduct**

Build the payload only from approved fields. Use `createProduct` when no `_id` exists and `updateProduct` otherwise. On success, show “保存成功”, call `wx.navigateBack()`, and let the management page reload in `onShow`. Handle `DUPLICATE_BARCODE` by showing “条形码已存在，请返回编辑已有商品”.

- [ ] **Step 5: Build form UI**

Create labeled fields for barcode, name, price in yuan, specification, unit, image, remark, and status. In create mode provide a scan icon beside barcode; in edit mode allow barcode editing but warn that it must remain unique. Show “保存商品” as primary action and “上架/下架” as a separate status action in edit mode.

- [ ] **Step 6: Run tests, manually verify, and commit**

Run: `npm test`

Expected: all tests PASS, including yuan-to-cents cases.

Manual cases:

- Scan new barcode, save required fields, and see it in management list.
- Enter existing barcode manually and receive duplicate guidance.
- Edit price and verify future scans show the new price.
- Existing cart item retains its captured old price.
- Downrank item and verify staff scans receive “商品已下架”.

```powershell
git add miniprogram/pages/product-edit miniprogram/utils/money.js tests/cart.test.js cloudfunctions/quickstartFunctions
git commit -m "feat: add product create and edit workflow"
```

---

### Task 9: Configure Cloud Resources, Documentation, and End-to-End Verification

**Files:**
- Modify: `README.md`
- Modify: `miniprogram/app.js` only to insert the real environment ID supplied by the maintainer

**Interfaces:**
- Consumes all prior tasks
- Produces an operational deployment checklist and verified end-to-end build

- [ ] **Step 1: Create cloud database collections manually**

In WeChat Developer Tools → 云开发 → 数据库:

1. Create `products`.
2. Create `admins`.
3. Add the maintainer record to `admins` with exact fields `openid`, `name`, `enabled: true`, and `createdAt`.
4. Configure database permissions so clients cannot directly write `products` or `admins`; writes occur only through the cloud function.

- [ ] **Step 2: Configure the real cloud environment**

Copy the environment ID from the Cloud Development console. Replace the empty string assigned to `globalData.env` in `miniprogram/app.js` with that exact copied value. Do not invent an environment ID, and do not proceed to deployment while the value is still empty.

- [ ] **Step 3: Deploy the cloud function**

In WeChat Developer Tools, right-click `cloudfunctions/quickstartFunctions` and choose “上传并部署：云端安装依赖”. Wait for successful deployment before UI testing.

- [ ] **Step 4: Replace QuickStart README with operator documentation**

Document:

- Project purpose and role differences.
- Environment ID setup.
- Creating `products` and `admins`.
- Finding an administrator OpenID through `getCurrentUser` or cloud logs.
- Deploying `quickstartFunctions`.
- Running `npm test`.
- Product schema and price-in-cents rule.
- The fact that the pricing list is intentionally not persisted.

- [ ] **Step 5: Run automated verification**

Run:

```powershell
npm test
```

Expected: every test passes with zero failures.

- [ ] **Step 6: Run end-to-end role and pricing scenarios**

Verify in WeChat Developer Tools and at least one real device:

1. Non-admin sees no management entry and receives `FORBIDDEN` if invoking a management action through debugging tools.
2. Admin scans an unknown barcode and creates a product.
3. Staff scans that barcode and sees the correct current price.
4. Staff adds three distinct products, rescans one, and sees correct integer quantities, subtotals, total pieces, and total amount.
5. Staff restarts the mini program and sees an empty pricing list.
6. Admin changes a product price; existing in-memory item keeps its captured price while a new session uses the updated price.
7. Admin downranks a product; staff cannot add it.
8. Network failure leaves the current pricing list unchanged.

- [ ] **Step 7: Final commit**

```powershell
git add README.md miniprogram/app.js
git commit -m "docs: add cloud setup and verification guide"
git status --short
```

Expected: clean working tree.
