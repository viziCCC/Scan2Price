const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const ctx = cloud.getWXContext();
  return {
    openid: ctx.OPENID,
    appid: ctx.APPID,
    unionid: ctx.UNIONID || null,
    env: ctx.ENV
  };
};
