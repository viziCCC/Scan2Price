const { callCloud } = require("../../utils/cloudApi");

Page({
  data: {
    items: [],
    loading: true,
    showForm: false,
    formData: { openid: "", role: "admin", remark: "" },
    editingOpenId: null,
    submitting: false
  },

  onLoad() {
    this.checkPermission();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) this.getTabBar().setData({ selected: 3 });
  },

  async checkPermission() {
    const app = getApp();
    try {
      const user = app.globalData.currentUser || await app.loadCurrentUser();
      if (!user.isSuperAdmin) {
        wx.showModal({ title: "无权限", content: "该页面仅超级管理员可用", showCancel: false, success: () => wx.switchTab({ url: "/pages/index/index" }) });
        return;
      }
      this.loadAdmins();
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || "身份获取失败", icon: "none" });
    }
  },

  async loadAdmins() {
    try {
      const result = await callCloud("listAdmins");
      this.setData({ items: result.items, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || "加载失败", icon: "none" });
    }
  },

  openCreate() {
    this.setData({
      showForm: true,
      editingOpenId: null,
      formData: { openid: "", role: "admin", remark: "" }
    });
  },

  openEdit(e) {
    const { openid, role, remark } = e.currentTarget.dataset;
    this.setData({
      showForm: true,
      editingOpenId: openid,
      formData: { openid, role, remark: remark || "" }
    });
  },

  closeForm() {
    this.setData({ showForm: false, editingOpenId: null });
  },

  onFormInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  onRoleChange(e) {
    this.setData({ "formData.role": e.detail.value });
  },

  async submitForm() {
    const { formData, editingOpenId, submitting } = this.data;
    if (submitting) return;
    if (!String(formData.openid || "").trim()) {
      return wx.showToast({ title: "请输入用户ID", icon: "none" });
    }
    this.setData({ submitting: true });
    try {
      if (editingOpenId) {
        const updates = {};
        if (formData.role) updates.role = formData.role;
        if (formData.remark !== undefined) updates.remark = formData.remark;
        await callCloud("updateAdmin", { openid: editingOpenId, ...updates });
        wx.showToast({ title: "已更新", icon: "success" });
      } else {
        await callCloud("createAdmin", formData);
        wx.showToast({ title: "已添加", icon: "success" });
      }
      this.closeForm();
      this.loadAdmins();
    } catch (e) {
      wx.showToast({ title: e.message || "操作失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleEnabled(e) {
    const { openid, enabled } = e.currentTarget.dataset;
    const newEnabled = !enabled;
    const action = newEnabled ? "启用" : "禁用";
    try {
      const { confirm } = await wx.showModal({
        title: "确认操作",
        content: `确定要${action}此账号吗？`,
        confirmText: action
      });
      if (!confirm) return;
      await callCloud("updateAdmin", { openid, enabled: newEnabled });
      wx.showToast({ title: "已" + action, icon: "success" });
      this.loadAdmins();
    } catch (err) {
      wx.showToast({ title: err.message || "操作失败", icon: "none" });
    }
  },

  async removeAdmin(e) {
    const { openid } = e.currentTarget.dataset;
    try {
      const { confirm } = await wx.showModal({
        title: "确认删除",
        content: "删除后该用户将失去管理员权限，确定删除吗？",
        confirmText: "删除",
        confirmColor: "#e11d48"
      });
      if (!confirm) return;
      await callCloud("removeAdmin", { openid });
      wx.showToast({ title: "已删除", icon: "success" });
      this.loadAdmins();
    } catch (err) {
      wx.showToast({ title: err.message || "删除失败", icon: "none" });
    }
  },

  async copyOpenId(e) {
    const { openid } = e.currentTarget.dataset;
    try {
      await wx.setClipboardData({ data: openid });
      wx.showToast({ title: "已复制", icon: "success" });
    } catch (err) {
      wx.showToast({ title: "复制失败", icon: "none" });
    }
  }
});