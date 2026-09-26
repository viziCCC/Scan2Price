const { callCloud } = require("../../utils/cloudApi");
const { addItem, summarize } = require("../../utils/cart");
const { formatCents } = require("../../utils/money");
const { scanBarcode } = require("../../utils/scan");
Page({
  data: { barcodeInput: "", product: null, displayPrice: "0.00", loading: false, isAdmin: false, isSuperAdmin: false, cartQuantity: 0 },
  async onShow() { if (typeof this.getTabBar === "function" && this.getTabBar()) this.getTabBar().setData({ selected: 0 }); const app = getApp(); try { const user = app.globalData.currentUser || await app.loadCurrentUser(); this.setData({ isAdmin: user.isAdmin, isSuperAdmin: !!user.isSuperAdmin }); } catch (e) { wx.showToast({ title: e.message || "身份获取失败", icon: "none" }); } this.refreshCartCount(); },
  refreshCartCount() { this.setData({ cartQuantity: summarize(getApp().globalData.cartItems).totalQuantity }); },
  async handleScan() { try { const barcode = await scanBarcode(); if (barcode) await this.searchBarcode(barcode); } catch (e) { wx.showToast({ title: "扫码失败", icon: "none" }); } },
  onBarcodeInput(e) { this.setData({ barcodeInput: e.detail.value }); },
  handleManualSearch() { this.searchBarcode(this.data.barcodeInput); },
  async searchBarcode(barcode) { if (!String(barcode || "").trim()) return wx.showToast({ title: "请输入条形码", icon: "none" }); this.setData({ loading: true, product: null }); try { const product = await callCloud("getProductByBarcode", { barcode: String(barcode).trim() }); this.setData({ product, barcodeInput: product.barcode, displayPrice: formatCents(product.priceInCents) }); const app = getApp(); app.globalData.cartItems = addItem(app.globalData.cartItems, product); this.refreshCartCount(); wx.showToast({ title: "已加入价格清单", icon: "success" }); } catch (e) { if (e.code === "PRODUCT_NOT_FOUND" && this.data.isAdmin) { wx.showModal({ title: "商品未录入", content: "是否直接录入该商品？", success: (r) => r.confirm && wx.navigateTo({ url: `/pages/product-edit/index?barcode=${encodeURIComponent(barcode)}` }) }); } else wx.showModal({ title: "查询失败", content: e.code === "PRODUCT_OFF_SALE" ? "商品已下架" : e.message, showCancel: false }); } finally { this.setData({ loading: false }); } },
  addCurrentProduct() { if (!this.data.product) return; const app = getApp(); app.globalData.cartItems = addItem(app.globalData.cartItems, this.data.product); this.refreshCartCount(); wx.showToast({ title: "已加入价格清单", icon: "success" }); },
  openCart() { wx.switchTab({ url: "/pages/cart/index" }); },
  openProductManagement() { wx.navigateTo({ url: "/pages/products/index" }); },
  openMyId() { wx.navigateTo({ url: "/pages/my-id/index" }); },
  openAdminUsers() { wx.navigateTo({ url: "/pages/admin-users/index" }); },
});
