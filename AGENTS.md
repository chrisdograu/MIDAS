# Architecture rules

- Checkout applies and records coupons atomically inside `create_order_secure`; the client must never redeem a coupon separately.
- Customer-facing code must not update order status directly; order state changes belong to trusted database functions or staff workflows.