const { BusinessError } = require("../lib/errors");

function createAuthService({ db, getOpenId }) {
  async function getCurrentUser() {
    const openid = await getOpenId();
    const result = await db
      .collection("admins")
      .where({ openid, enabled: true })
      .limit(1)
      .get();

    return {
      openid,
      isAdmin: Array.isArray(result.data) && result.data.length > 0
    };
  }

  async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      throw new BusinessError("FORBIDDEN", "无管理员权限");
    }
    return user;
  }

  return { getCurrentUser, requireAdmin };
}

module.exports = { createAuthService };
