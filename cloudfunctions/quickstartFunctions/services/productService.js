const { BusinessError } = require("../lib/errors");
const { normalizeBarcode, validateProductInput } = require("../lib/validation");

function createProductService({ db, authService, now = () => new Date() }) {
  async function findByBarcode(barcode) {
    const result = await db.collection("products").where({ barcode }).limit(1).get();
    return Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
  }

  function normalizePage(value, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async function getProductByBarcode({ barcode, includeOffSale = false } = {}) {
    const normalized = normalizeBarcode(barcode);
    if (includeOffSale) await authService.requireAdmin();
    const product = await findByBarcode(normalized);
    if (!product) throw new BusinessError("PRODUCT_NOT_FOUND", "商品未录入");
    if (!includeOffSale && product.status !== "on_sale") {
      throw new BusinessError("PRODUCT_OFF_SALE", "商品已下架");
    }
    return product;
  }

  async function getProductById({ productId } = {}) {
    await authService.requireAdmin();
    const id = String(productId || "").trim();
    if (!id) throw new BusinessError("INVALID_PRODUCT_ID", "商品 ID 不能为空");
    const result = await db.collection("products").doc(id).get();
    if (!result.data) throw new BusinessError("PRODUCT_NOT_FOUND", "商品未录入");
    return result.data;
  }

  async function listProducts({ keyword = "", status = "", page = 1, pageSize = 20 } = {}) {
    await authService.requireAdmin();
    const safePage = normalizePage(page, 1);
    const safePageSize = Math.min(50, normalizePage(pageSize, 20));
    const normalizedKeyword = String(keyword ?? "").trim();
    const where = {};
    if (["on_sale", "off_sale"].includes(status)) where.status = status;
    if (normalizedKeyword && /^[0-9]+$/.test(normalizedKeyword)) {
      where.barcode = normalizeBarcode(normalizedKeyword);
    }

    let query = db.collection("products").where(where);
    const usesNameRegex = normalizedKeyword && !where.barcode && typeof db.RegExp === "function";
    if (usesNameRegex) {
      query = query.where({ name: db.RegExp({ regexp: escapeRegExp(normalizedKeyword), options: "i" }) });
    }

    let items;
    if (normalizedKeyword && !where.barcode && !usesNameRegex) {
      const result = await query.get();
      const needle = normalizedKeyword.toLocaleLowerCase();
      items = (Array.isArray(result.data) ? result.data : [])
        .filter((item) => String(item.name || "").toLocaleLowerCase().includes(needle))
        .sort((left, right) => {
          const leftTime = left.updatedAt instanceof Date ? left.updatedAt.getTime() : Date.parse(left.updatedAt || "") || 0;
          const rightTime = right.updatedAt instanceof Date ? right.updatedAt.getTime() : Date.parse(right.updatedAt || "") || 0;
          return rightTime - leftTime;
        })
        .slice((safePage - 1) * safePageSize, safePage * safePageSize);
    } else {
      const result = await query.orderBy("updatedAt", "desc")
        .skip((safePage - 1) * safePageSize)
        .limit(safePageSize)
        .get();
      items = Array.isArray(result.data) ? result.data : [];
    }
    return { items, page: safePage, pageSize: safePageSize };
  }

  async function createProduct(input = {}) {
    const admin = await authService.requireAdmin();
    const product = validateProductInput(input);
    if (await findByBarcode(product.barcode)) {
      throw new BusinessError("DUPLICATE_BARCODE", "条形码已存在");
    }
    const timestamp = now();
    const data = {
      ...product,
      createdBy: admin.openid,
      createdAt: timestamp,
      updatedBy: admin.openid,
      updatedAt: timestamp
    };
    const result = await db.collection("products").add({ data });
    return { _id: result._id, ...product };
  }

  async function updateProduct(input = {}) {
    const admin = await authService.requireAdmin();
    const productId = String(input.productId ?? "").trim();
    if (!productId) throw new BusinessError("INVALID_PRODUCT_ID", "商品 ID 不能为空");
    const product = validateProductInput(input);
    const duplicate = await findByBarcode(product.barcode);
    if (duplicate && duplicate._id !== productId) {
      throw new BusinessError("DUPLICATE_BARCODE", "条形码已存在");
    }
    await db.collection("products").doc(productId).update({
      data: {
        ...product,
        updatedBy: admin.openid,
        updatedAt: now()
      }
    });
    return { _id: productId, ...product };
  }

  async function changeProductStatus({ productId, status } = {}) {
    const admin = await authService.requireAdmin();
    const normalizedId = String(productId ?? "").trim();
    if (!normalizedId) throw new BusinessError("INVALID_PRODUCT_ID", "商品 ID 不能为空");
    if (!["on_sale", "off_sale"].includes(status)) {
      throw new BusinessError("INVALID_STATUS", "商品状态不合法");
    }
    await db.collection("products").doc(normalizedId).update({
      data: {
        status,
        updatedBy: admin.openid,
        updatedAt: now()
      }
    });
    return { productId: normalizedId, status };
  }

  return {
    getProductById,
    getProductByBarcode,
    listProducts,
    createProduct,
    updateProduct,
    changeProductStatus
  };
}

module.exports = { createProductService };
