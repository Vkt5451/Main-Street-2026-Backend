// backend/api/db.js
let orders = [];

export function createOrder(order) {
  const id = `order_${Date.now()}`; // simple unique ID
  const newOrder = { ...order, id, status: "pending" };
  orders.push(newOrder);
  return newOrder;
}

export function updateOrderStatus(orderId, status) {
  const order = orders.find(o => o.id === orderId);
  if (order) order.status = status;
  return order;
}

export function getOrder(orderId) {
  return orders.find(o => o.id === orderId);
}

export function getAllOrders() {
  return orders;
}
