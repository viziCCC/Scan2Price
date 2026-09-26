function scanBarcode() { return new Promise((resolve, reject) => { wx.scanCode({ scanType: ["barCode"] }).then((r) => resolve(String(r.result || "").trim() || null)).catch((e) => String(e.errMsg || "").includes("cancel") ? resolve(null) : reject(e)); }); }
module.exports = { scanBarcode };
