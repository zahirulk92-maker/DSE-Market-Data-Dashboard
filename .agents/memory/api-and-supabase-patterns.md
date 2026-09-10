---
name: API and Supabase patterns
description: Durable constraints for this workspace's generated API and Supabase integration.
---

OpenAPI operation parameters should avoid generating both path and query parameter type names from the same operation; when Orval emits duplicate `*Params` exports, simplify or rename the contract before relying on codegen.

**Why:** The workspace re-exports generated Zod schemas and generated types from one barrel, so a naming collision fails the shared library typecheck even though Orval itself succeeds.

**How to apply:** After every OpenAPI change, run codegen and the library typecheck before wiring the generated hooks into an app.

Application code should access the connected Supabase project through the Replit connector SDK proxy rather than storing project URLs or API keys in source.

**Why:** The connector owns credential injection and refresh, and the project intentionally keeps Supabase credentials outside the repository.

**How to apply:** Keep Supabase calls server-side, use PostgREST paths through the connector, and preserve a visible fallback state when the external tables or live DSE feed are not populated.