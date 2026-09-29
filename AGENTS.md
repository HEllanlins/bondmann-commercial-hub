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
