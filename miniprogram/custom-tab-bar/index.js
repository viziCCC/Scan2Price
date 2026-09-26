Component({
  data: {
    selected: 0,
    list: [
      { pagePath: "/pages/index/index", text: "扫码查价", iconPath: "/images/icons/home.png", selectedIconPath: "/images/icons/home-active.png", show: true },
      { pagePath: "/pages/cart/index", text: "价格清单", iconPath: "/images/icons/goods.png", selectedIconPath: "/images/icons/goods-active.png", show: true },
      { pagePath: "/pages/products/index", text: "商品管理", iconPath: "/images/icons/products.png", selectedIconPath: "/images/icons/products-active.png", show: false },
      { pagePath: "/pages/admin-users/index", text: "用户管理", iconPath: "/images/icons/users.png", selectedIconPath: "/images/icons/users-active.png", show: false }
    ]
  },
  attached() {
    this.loadUserPermissions();
  },
  methods: {
    async loadUserPermissions() {
      const app = getApp();
      try {
        const user = app.globalData.currentUser || await app.loadCurrentUser();
        const isAdmin = !!user.isAdmin;
        const isSuperAdmin = !!user.isSuperAdmin;
        const list = this.data.list.map((item, index) => {
          if (index === 2) return { ...item, show: isAdmin };
          if (index === 3) return { ...item, show: isSuperAdmin };
          return item;
        });
        this.setData({ list });
      } catch (e) {
        console.error("加载用户权限失败", e);
      }
    },
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    }
  }
});