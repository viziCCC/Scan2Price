const { BusinessError } = require("../lib/errors");

function normalizeOpenId(value) {
  const openid = String(value ?? "").trim();
  if (!openid) throw new BusinessError("INVALID_OPENID", "用户 ID 不能为空");
  return openid;
}

function createAuthService({ db, getOpenId }) {
  async function getCurrentUser() {
    const openid = await getOpenId();
    const result = await db
      .collection("admins")
      .where({ openid, enabled: true })
      .limit(1)
      .get();

    const record = Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
    return {
      openid,
      isAdmin: !!record,
      isSuperAdmin: !!record && record.role === "super_admin"
    };
  }

  async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      throw new BusinessError("FORBIDDEN", "无管理员权限");
    }
    return user;
  }

  async function requireSuperAdmin() {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      throw new BusinessError("FORBIDDEN", "无管理员权限");
    }
    if (!user.isSuperAdmin) {
      throw new BusinessError("FORBIDDEN", "仅超级管理员可执行此操作");
    }
    return user;
  }

  async function listAdmins() {
    await requireSuperAdmin();
    const result = await db.collection("admins")
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();
    return { items: Array.isArray(result.data) ? result.data : [] };
  }

  async function createAdmin({ openid, role = "admin", remark = "" } = {}) {
    const operator = await requireSuperAdmin();
    const targetOpenId = normalizeOpenId(openid);
    if (!["admin", "super_admin"].includes(role)) {
      throw new BusinessError("INVALID_ROLE", "角色不合法");
    }
    const existing = await db.collection("admins").where({ openid: targetOpenId }).limit(1).get();
    if (Array.isArray(existing.data) && existing.data.length > 0) {
      throw new BusinessError("DUPLICATE_OPENID", "该用户已存在");
    }
    const timestamp = new Date();
    const data = {
      openid: targetOpenId,
      role,
      enabled: true,
      remark: String(remark ?? "").trim(),
      createdBy: operator.openid,
      createdAt: timestamp,
      updatedBy: operator.openid,
      updatedAt: timestamp
    };
    const result = await db.collection("admins").add({ data });
    return { _id: result._id, ...data };
  }

  async function updateAdmin({ openid, role, enabled, remark } = {}) {
    const operator = await requireSuperAdmin();
    const targetOpenId = normalizeOpenId(openid);
    const existing = await db.collection("admins").where({ openid: targetOpenId }).limit(1).get();
    if (!Array.isArray(existing.data) || existing.data.length === 0) {
      throw new BusinessError("ADMIN_NOT_FOUND", "用户不存在");
    }
    const record = existing.data[0];

    const updates = {};
    if (role !== undefined) {
      if (!["admin", "super_admin"].includes(role)) {
        throw new BusinessError("INVALID_ROLE", "角色不合法");
      }
      if (record.role === "super_admin" && role !== "super_admin") {
        const supers = await db.collection("admins")
          .where({ role: "super_admin", enabled: true })
          .count();
        if (supers.total <= 1) {
          throw new BusinessError("LAST_SUPER_ADMIN", "至少保留一个启用的超级管理员");
        }
      }
      updates.role = role;
    }
    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        throw new BusinessError("INVALID_ENABLED", "enabled 必须为布尔值");
      }
      if (record.enabled === true && enabled === false && record.role === "super_admin") {
        const supers = await db.collection("admins")
          .where({ role: "super_admin", enabled: true })
          .count();
        if (supers.total <= 1) {
          throw new BusinessError("LAST_SUPER_ADMIN", "至少保留一个启用的超级管理员");
        }
      }
      updates.enabled = enabled;
    }
    if (remark !== undefined) updates.remark = String(remark ?? "").trim();

    if (Object.keys(updates).length === 0) {
      throw new BusinessError("NOTHING_TO_UPDATE", "没有需要更新的字段");
    }
    updates.updatedBy = operator.openid;
    updates.updatedAt = new Date();

    await db.collection("admins").doc(record._id).update({ data: updates });
    return { openid: targetOpenId, ...updates };
  }

  async function removeAdmin({ openid } = {}) {
    const operator = await requireSuperAdmin();
    const targetOpenId = normalizeOpenId(openid);
    if (targetOpenId === operator.openid) {
      throw new BusinessError("CANNOT_REMOVE_SELF", "不能删除自己的账号");
    }
    const existing = await db.collection("admins").where({ openid: targetOpenId }).limit(1).get();
    if (!Array.isArray(existing.data) || existing.data.length === 0) {
      throw new BusinessError("ADMIN_NOT_FOUND", "用户不存在");
    }
    const record = existing.data[0];
    if (record.role === "super_admin") {
      const supers = await db.collection("admins")
        .where({ role: "super_admin", enabled: true })
        .count();
      if (supers.total <= 1) {
        throw new BusinessError("LAST_SUPER_ADMIN", "至少保留一个启用的超级管理员");
      }
    }
    await db.collection("admins").doc(record._id).remove();
    return { openid: targetOpenId };
  }

  return {
    getCurrentUser,
    requireAdmin,
    requireSuperAdmin,
    listAdmins,
    createAdmin,
    updateAdmin,
    removeAdmin
  };
}

module.exports = { createAuthService };
