Page({
  data: {
    openid: '',
    loading: true,
    copied: false
  },

  onLoad() {
    this.loadOpenId();
  },

  async loadOpenId() {
    try {
      const res = await wx.cloud.callFunction({ name: 'debugOpenId' });
      this.setData({
        openid: res.result.openid,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '获取失败', icon: 'none' });
    }
  },

  async copyOpenId() {
    if (!this.data.openid) return;

    try {
      await wx.setClipboardData({ data: this.data.openid });
      this.setData({ copied: true });
      setTimeout(() => this.setData({ copied: false }), 2000);
    } catch (e) {
      wx.showToast({ title: '复制失败', icon: 'none' });
    }
  },

});