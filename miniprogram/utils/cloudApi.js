async function callCloud(type, data = {}) {
  const response = await wx.cloud.callFunction({ name: "quickstartFunctions", data: { type, data } });
  const result = response.result || {};
  if (!result.success) {
    const error = new Error(result.error?.message || "服务暂时不可用");
    error.code = result.error?.code || "NETWORK_ERROR";
    throw error;
  }
  return result.data;
}
module.exports = { callCloud };
