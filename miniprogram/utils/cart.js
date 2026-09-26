function addItem(items, product) {
  const existing = items.find((item) => item.productId === product._id);
  if (existing) return items.map((item) => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item);
  return [...items, { productId: product._id, barcode: product.barcode, name: product.name, specification: product.specification || "", unit: product.unit || "", priceInCents: product.priceInCents, quantity: 1 }];
}
function changeQuantity(items, productId, delta) { return items.map((item) => item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item); }
function removeItem(items, productId) { return items.filter((item) => item.productId !== productId); }
function summarize(items) { return items.reduce((t, i) => ({ totalQuantity: t.totalQuantity + i.quantity, totalInCents: t.totalInCents + i.priceInCents * i.quantity }), { totalQuantity: 0, totalInCents: 0 }); }
module.exports = { addItem, changeQuantity, removeItem, summarize };
