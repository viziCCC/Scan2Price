const { callCloud } = require("../../utils/cloudApi");
const { addItem, changeQuantity, removeItem, summarize } = require("../../utils/cart");
const { formatCents } = require("../../utils/money");
const { scanBarcode } = require("../../utils/scan");
Page({
  data: { items: [], totalQuantity: 0, displayTotal: "0.00", editingId: null, editingValue: "" },
  onShow() { if (typeof this.getTabBar === "function" && this.getTabBar()) this.getTabBar().setData({ selected: 1 }); this.refresh(); },
  refresh() { const items = getApp().globalData.cartItems; const s = summarize(items); this.setData({ items: items.map((i) => ({ ...i, displayPrice: formatCents(i.priceInCents), displaySubtotal: formatCents(i.priceInCents * i.quantity) })), totalQuantity: s.totalQuantity, displayTotal: formatCents(s.totalInCents) }); },
  async scanAndAdd() { try { const barcode = await scanBarcode(); if (!barcode) return; const product = await callCloud("getProductByBarcode", { barcode }); const app = getApp(); app.globalData.cartItems = addItem(app.globalData.cartItems, product); this.refresh(); wx.showToast({ title: "已添加，可继续扫码", icon: "success" }); } catch (e) { wx.showModal({ title: "添加失败", content: e.code === "PRODUCT_OFF_SALE" ? "商品已下架" : e.message, showCancel: false }); } },
  increaseQuantity(e) { this.updateQuantity(e, 1); },
  decreaseQuantity(e) { const id = e.currentTarget.dataset.productId; const item = getApp().globalData.cartItems.find((i) => i.productId === id); if (item && item.quantity === 1) return wx.showModal({ title: "移除商品", content: "数量已经是 1，是否移除？", success: (r) => { if (r.confirm) { getApp().globalData.cartItems = removeItem(getApp().globalData.cartItems, id); this.refresh(); } } }); this.updateQuantity(e, -1); },
  updateQuantity(e, delta) { const app = getApp(); app.globalData.cartItems = changeQuantity(app.globalData.cartItems, e.currentTarget.dataset.productId, delta); this.refresh(); },
  editQuantity(e) { const id = e.currentTarget.dataset.productId; const item = getApp().globalData.cartItems.find((i) => i.productId === id); if (!item) return; this.setData({ editingId: id, editingValue: String(item.quantity) }); },
  onEditingInput(e) { this.setData({ editingValue: e.detail.value }); },
  commitEditing() { const { editingId, editingValue } = this.data; if (!editingId) return; const q = parseInt(editingValue, 10); const app = getApp(); if (!q || q < 1) { app.globalData.cartItems = removeItem(app.globalData.cartItems, editingId); } else { app.globalData.cartItems = app.globalData.cartItems.map((i) => i.productId === editingId ? { ...i, quantity: q } : i); } this.setData({ editingId: null, editingValue: "" }); this.refresh(); },
  cancelEditing() { this.setData({ editingId: null, editingValue: "" }); },
  removeItem(e) { const app = getApp(); app.globalData.cartItems = removeItem(app.globalData.cartItems, e.currentTarget.dataset.productId); this.refresh(); },
  clearCart() { wx.showModal({ title: "清空清单", content: "确定清空当前价格清单吗？", success: (r) => { if (r.confirm) { getApp().globalData.cartItems = []; this.refresh(); } } }); },
});
