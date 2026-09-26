function formatCents(cents) { return (Number(cents || 0) / 100).toFixed(2); }
function yuanTextToCents(value) { const match = String(value).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/); if (!match) throw new Error("请输入正确价格，最多两位小数"); return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0")); }
module.exports = { formatCents, yuanTextToCents };
