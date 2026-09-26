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
  getProductById: (event) => productService.getProductById(event.data || {}),
  getProductByBarcode: (event) => productService.getProductByBarcode(event.data || {}),
  listProducts: (event) => productService.listProducts(event.data || {}),
  createProduct: (event) => productService.createProduct(event.data || {}),
  updateProduct: (event) => productService.updateProduct(event.data || {}),
  changeProductStatus: (event) => productService.changeProductStatus(event.data || {}),
  listAdmins: () => authService.listAdmins(),
  createAdmin: (event) => authService.createAdmin(event.data || {}),
  updateAdmin: (event) => authService.updateAdmin(event.data || {}),
  removeAdmin: (event) => authService.removeAdmin(event.data || {})
};

exports.main = async (event = {}) => {
  try {
    const handler = handlers[event.type];
    if (!handler) throw new BusinessError("UNKNOWN_ACTION", "不支持的操作");
    return { success: true, data: await handler(event) };
  } catch (error) {
    console.error("云函数执行异常", {
      eventType: event.type,
      eventData: event.data,
      errorName: error.name,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack
    });
    const isBusinessError = error instanceof BusinessError;
    return {
      success: false,
      error: {
        code: isBusinessError ? error.code : "INTERNAL_ERROR",
        message: isBusinessError ? error.message : "服务暂时不可用",
        errorName: error.name || "UnknownError",
        details: isBusinessError ? error.details : null
      }
    };
  }
};
