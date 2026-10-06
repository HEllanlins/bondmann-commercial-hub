<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Auth return URLs live only in src/lib/auth/redirects.ts (VITE_SITE_URL or current origin) — one place to switch to the Vercel domain.
- Google login uses the managed broker unless VITE_AUTH_OAUTH_MODE=direct — the broker path does not exist outside Lovable hosting.
- Account experiences are separate from platform roles; representative and organization signups never grant staff/admin privileges, preventing cross-tenant access.
- Organizations, memberships, subscriptions and plan-feature entitlements are additive platform tables; existing prospect companies remain the Bondmann internal CRM dataset.
- Subscription and membership actions use authenticated database RPCs with server-enforced ownership, state and limits; menus are not the authorization boundary.
- Feature availability is effective only when a registered implementation exists; enabling an undeveloped feature must retain the coming-soon state.
- Plans and feature assignments are persisted in platform tables, while shared platform UI and query contracts live under src/lib/platform and src/components/platform.
