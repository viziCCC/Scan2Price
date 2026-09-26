async function callCloud(type, data = {}) {
  const response = await wx.cloud.callFunction({ name: "quickstartFunctions", data: { type, data } });
  const result = response.result || {};
  if (!result.success) {
    const serverError = result.error || {};
    const error = new Error(serverError.message || "服务暂时不可用");
    error.code = serverError.code || "NETWORK_ERROR";
    error.errorName = serverError.errorName || "";
    console.error(`[云调用失败] action=${type} code=${error.code} errorName=${error.errorName}`, serverError);
    throw error;
  }
  return result.data;
}
module.exports = { callCloud };
