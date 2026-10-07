# Architecture rules

- Checkout applies and records coupons atomically inside `create_order_secure`; the client must never redeem a coupon separately.
- Customer-facing code must not update order status directly; order state changes belong to trusted database functions or staff workflows.
- Public team and developer pages read the same Supabase records managed by admin-only desktop screens, so edits appear publicly without hardcoded duplicate content.
- Public developer profiles resolve either a UUID or a slug and normalize product rows with `mapProdutoToGame`; this keeps existing links and game cards compatible.