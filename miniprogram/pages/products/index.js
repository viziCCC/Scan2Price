const { callCloud } = require("../../utils/cloudApi");
const { formatCents } = require("../../utils/money");
const { scanBarcode } = require("../../utils/scan");
Page({
  data: { keyword: "", status: "on_sale", items: [], isAdmin: false },
  async onLoad() { const app = getApp(); try { const user = app.globalData.currentUser || await app.loadCurrentUser(); if (!user.isAdmin) return wx.showModal({ title: "无权限", content: "该页面仅管理员可用", showCancel: false, success: () => wx.navigateBack() }); this.setData({ isAdmin: true }); this.loadProducts(); } catch (e) { wx.showToast({ title: e.message, icon: "none" }); } },
  onShow() { if (this.data.isAdmin) this.loadProducts(); },
  onKeywordInput(e) { this.setData({ keyword: e.detail.value }); },
  setStatus(e) { this.setData({ status: e.currentTarget.dataset.status }); this.loadProducts(); },
  async loadProducts() { try { const data = await callCloud("listProducts", { keyword: this.data.keyword, status: this.data.status }); this.setData({ items: data.items.map((i) => ({ ...i, displayPrice: formatCents(i.priceInCents) })) }); } catch (e) { wx.showToast({ title: e.message, icon: "none" }); } },
  search() { this.loadProducts(); },
  async scanToCreateOrEdit() { let barcode; try { barcode = await scanBarcode(); if (!barcode) return; const product = await callCloud("getProductByBarcode", { barcode, includeOffSale: true }); wx.navigateTo({ url: `/pages/product-edit/index?id=${product._id}` }); } catch (e) { if (e.code === "PRODUCT_NOT_FOUND") wx.navigateTo({ url: `/pages/product-edit/index?barcode=${encodeURIComponent(barcode)}` }); else wx.showToast({ title: e.message, icon: "none" }); } },
  openManualCreate() { wx.navigateTo({ url: "/pages/product-edit/index" }); },
  openEdit(e) { wx.navigateTo({ url: `/pages/product-edit/index?id=${e.currentTarget.dataset.id}` }); },
});
