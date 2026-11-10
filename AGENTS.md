# Architecture rules

- Notification controls update only the existing `is_read` field; notification preferences map database event types to UI categories, and mobile customization links open the profile sheet via the URL query so deep links work.
- The mobile header notification bell navigates to the mobile notification page rather than mounting the web dropdown; this prevents the dropdown backdrop from trapping header touches and constrains the content to the mobile page.
- Successful profile and game cosmetic writes notify mounted loadout readers through user-scoped browser events (also product-scoped for games); this refreshes previews without requiring database realtime publication settings.
- Cosmetic overlays render the persisted equipped loadout, not fictional saved-theme navigation; visibility preferences must reset when the owner or game changes.

- Mobile chat controls live in a presentation-only toolbar; collapsing filters and grouping actions must preserve conversation filtering, tabs, and data access behavior.

- Developer search shares a named-record loader and destination mapper across web and desktop; public results link to profiles, and admin results filter the existing management screen without widening permissions.

- Checkout applies and records coupons atomically inside `create_order_secure`; the client must never redeem a coupon separately.
- Checkout blocks confirmation while coupon validation is pending, so a rehearsal cannot submit an unintended undiscounted order.
- Successful trusted order creation invalidates the buyer's order and library queries; browser navigation never grants ownership.
- Rehearsal dashboard activity and participant counts come from persisted records; login history is labeled as recent logins, never online sessions or invented retention.
- Customer-facing code must not update order status directly; order state changes belong to trusted database functions or staff workflows.
- Public team and developer pages read the same Supabase records managed by admin-only desktop screens, so edits appear publicly without hardcoded duplicate content.
- Desktop developer CRUD uses table writes protected by existing administrator RLS, not absent admin RPCs; updates and deletes verify returned rows before reporting success.
- Public developer profiles resolve either a UUID or a slug and normalize product rows with `mapProdutoToGame`; this keeps existing links and game cards compatible.
- Developer channel permissions are scoped in a separate assignment table and enforced by RLS; delegated managers never receive desktop administrator roles.
- Official developer publications live in a separate web-only channel with paginated comments, independent of game forums.

- Developer catalog filters operate on the publicly readable active games already loaded for that studio; filter and sort logic is isolated and tested without additional database queries.
- Game information pages and card prefetch share a product loader that resolves the studio by developer_id and links to its slug or UUID; publisher names must never be used to infer a developer.
- Tournament forms write explicit live-schema fields, resolve games through product_id, and read registration timestamps as joined_at (waitlists use created_at); this avoids legacy-field failures.
- Tournament stream history is derived from persisted tournament_live_events rather than a separate assumed history table; public pages never query nonexistent resources.
- Key search and publisher pagination operate only on records already authorized and loaded by their management screens, using shared catalog-list helpers; navigation aliases redirect to the existing permission-protected canonical route.
- Bundle gallery records synchronize persisted bundle cover/images through a database trigger; this keeps admin uploads and public carousels consistent.
- Order transitions and privacy changes write immutable history through database triggers; customer refund requests create support tickets, never change order status.
- List saves/follows are user-scoped database records; public follower counts expose only aggregates, not follower identities.
- Price alerts are claimed atomically in the database and reset only when the target changes; this prevents concurrent devices from repeating the same alert.
- Presence timestamps live in private user_presence records with authenticated heartbeats and privacy-filtered RPC reads; direct profile reads cannot bypass presence preferences.
- Category moves use one permission-checked transaction; this prevents partial reordering and concurrent lost swaps.
- Review comments reference either a short review or a complete review and an immutable same-review parent; database policies apply equally to root comments and replies.
- Data deletion requests are durable, idempotent, owner-authenticated workflows completed only by full administrators; the UI must not simulate identity emails or promise automatic erasure.
- Exposed RPC wrappers use SECURITY INVOKER over permission-checked implementations in app_private; trigger functions are not directly executable by application roles.
- Forum reactions reuse forum_post_likes with a reaction type and the existing count trigger; changing emoji does not remove and reinsert the user's reaction.
