# Security policy

## Scope

This project is a Vite/React reader with a Supabase backend. The HTML crawler runs only in the protected `crawler-worker` Supabase Edge Function and is intended for administrator-approved sources.

## Reporting

Do not publish credentials, cookies, service-role keys, private URLs, or copyrighted chapter dumps in an issue. Report security issues privately to the repository owner through GitHub's private vulnerability reporting/contact channel.

## Crawler safety requirements

- Keep `SUPABASE_SERVICE_ROLE_KEY` and any upstream credentials in Edge Function secrets only; never use them in `VITE_*` variables.
- Configure only public hostnames that the administrator is authorized to fetch.
- Do not enable arbitrary proxies, Cloudflare/VIP bypasses, cookie forwarding, or private-network targets.
- Keep the crawler migration and Edge Function deployed together; verify admin RLS policies before enabling the admin tab.
- Crawl and import only content whose use and redistribution are authorized, and preserve source attribution where required.

## Secret exposure

If a secret has ever been committed, rotate/revoke it before relying on repository removal. Removing a file from the current tree does not remove it from Git history or external caches.
