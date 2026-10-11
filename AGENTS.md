# Architecture rules

- Notification controls update only the existing `is_read` field; notification preferences map database event types to UI categories, and mobile customization links open the profile sheet via the URL query so deep links work.

- Mobile chat controls live in a presentation-only toolbar; collapsing filters and grouping actions must preserve conversation filtering, tabs, and data access behavior.

- Developer search shares a named-record loader and destination mapper across web and desktop; public results link to profiles, and admin results filter the existing management screen without widening permissions.

- Checkout applies and records coupons atomically inside `create_order_secure`; the client must never redeem a coupon separately.
- Customer-facing code must not update order status directly; order state changes belong to trusted database functions or staff workflows.
- Public team and developer pages read the same Supabase records managed by admin-only desktop screens, so edits appear publicly without hardcoded duplicate content.
- Public developer profiles resolve either a UUID or a slug and normalize product rows with `mapProdutoToGame`; this keeps existing links and game cards compatible.
- Developer channel permissions are scoped in a separate assignment table and enforced by RLS; delegated managers never receive desktop administrator roles.
- Official developer publications live in a separate web-only channel with paginated comments, independent of game forums.

- Developer catalog filters operate on the publicly readable active games already loaded for that studio; filter and sort logic is isolated and tested without additional database queries.
- Game information pages and card prefetch share a product loader that resolves the studio by developer_id and links to its slug or UUID; publisher names must never be used to infer a developer.
