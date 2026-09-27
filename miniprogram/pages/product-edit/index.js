const { callCloud } = require("../../utils/cloudApi");
const { yuanTextToCents, formatCents } = require("../../utils/money");
const { scanBarcode } = require("../../utils/scan");
Page({
  data: { id: "", form: { barcode: "", name: "", price: "", specification: "", unit: "", remark: "", status: "on_sale" }, editing: false },
  onLoad(options) { if (options.id) { this.setData({ id: options.id, editing: true }); this.load(options.id); } else if (options.barcode) this.setData({ "form.barcode": options.barcode }); },
  async load(id) { try { const p = await callCloud("getProductById", { productId: id }); this.setData({ form: { barcode: p.barcode, name: p.name, price: formatCents(p.priceInCents), specification: p.specification || "", unit: p.unit || "", remark: p.remark || "", status: p.status } }); } catch (e) { wx.showToast({ title: e.message, icon: "none" }); } },
  input(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },
  clearField(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: "" }); },
  async scan() { try { const b = await scanBarcode(); if (b) this.setData({ "form.barcode": b }); } catch (e) { wx.showToast({ title: "扫码失败", icon: "none" }); } },
  async submit() { try { const f = this.data.form; const data = { barcode: f.barcode, name: f.name, priceInCents: yuanTextToCents(f.price), specification: f.specification, unit: f.unit, remark: f.remark, status: f.status }; await callCloud(this.data.editing ? "updateProduct" : "createProduct", this.data.editing ? { productId: this.data.id, ...data } : data); wx.showToast({ title: "保存成功", icon: "success" }); setTimeout(() => wx.navigateBack(), 500); } catch (e) { wx.showToast({ title: e.message, icon: "none" }); } },
  changeStatus() { const status = this.data.form.status === "on_sale" ? "off_sale" : "on_sale"; if (!this.data.editing) return this.setData({ "form.status": status }); callCloud("changeProductStatus", { productId: this.data.id, status }).then(() => this.setData({ "form.status": status })).catch((e) => wx.showToast({ title: e.message, icon: "none" })); },
});
