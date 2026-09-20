# Wacko

One self-contained portfolio page, served by a small Node server. Cloudflare Tunnel connects to the localhost listener. No application npm dependencies or additional web pages.

## Start with npm and PM2

Use an up-to-date Node.js 24 LTS or newer supported LTS in a dedicated Proxmox VM or unprivileged LXC. Run the app as a normal user. Run cloudflared in that same guest and network namespace, not in a separate guest or isolated Docker network.

```bash
cd wacko-portfolio
npm install --ignore-scripts
npm install --global pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Run the system startup command printed by `pm2 startup`, then run `pm2 save` again. Use a user-owned Node installation for the global PM2 installation. A compiled page is included; no build is required to start it.

The server only binds to `127.0.0.1:3000`. A non-loopback HOST setting is refused. For a temporary local process, use `npm start` instead of PM2, not both at once.

## Cloudflare Tunnel

For a dashboard-managed tunnel, install cloudflared using Cloudflare's instructions and connect the tunnel using the service installation command shown in your dashboard. Keep the tunnel token outside this project.

Set the published application to:

| Setting | Value |
| --- | --- |
| Hostname | Your chosen portfolio hostname |
| Service type | HTTP |
| Service URL | `127.0.0.1:3000` |
| Path | Leave blank; Node only serves `/` |

This hostname mapping is required by Cloudflare to deliver the site. It does not create API routes or extra pages in the application.

Enable Always Use HTTPS for the public hostname. Cloudflare handles visitor-facing TLS; the last hop is HTTP over loopback inside the same guest. HSTS is returned by Node and applies when the visitor reaches the page over HTTPS.

Do not forward router ports for this site. Keep inbound access to ports 80, 443, and 3000 closed on the guest and router, while retaining your existing trusted management access. Allow cloudflared's documented outbound connectivity. Do not publish the Proxmox management interface through this tunnel.

For a locally managed tunnel, `cloudflared.example.yml` is an alternative configuration. Replace all three placeholders with your tunnel UUID, credential path, and public hostname. Its ingress matches only `/`, with a final 404 rule for everything else. Store real tunnel credentials outside this project with access restricted to the cloudflared service account. Validate the installed configuration with `cloudflared tunnel ingress validate`.

Keep Cloudflare features that inject or rewrite page scripts disabled for this hostname, including Rocket Loader and injected analytics. The page's hash-based Content Security Policy intentionally permits only its two bundled scripts and bundled stylesheet. Account-side WAF or rate-limiting rules may be added in Cloudflare; this package does not configure or claim to enable them.

## Public surface

- Only `GET /` and `HEAD /` return the page. Query strings are ignored and never reflected.
- Every other valid path returns 404, including `/index.html`, `/assets/`, `/credits.txt`, `/api`, `/admin`, `/health`, `/metrics`, and all source/configuration files. Malformed paths return 400.
- Icons, fonts, CSS, and the reactive animation are embedded in the HTML. There are no separate asset endpoints.
- Asset credits expand within the existing page; they do not open a new route.
- No accounts, forms, uploads, database, cookies, analytics, filesystem browsing, dynamic templates, proxy endpoints, or background browser network requests.
- Only hash-pinned scripts and CSS execute. No unsafe-inline, unsafe-eval, third-party resources, or outgoing browser connections are allowed.
- Requests cannot select a file from disk. The server loads a single known HTML file at startup and returns those same bytes for the root page.
- Non-read methods and request bodies are rejected. Header sizes, connection count, request durations, idle time, and requests per connection are bounded.
- Framing, MIME sniffing, referrers, and unnecessary browser permissions are restricted.

A public website cannot have zero attack surface. This setup minimizes the origin's exposure, but Node, cloudflared, PM2, the OS, account security, and the public Cloudflare endpoint remain relevant. Keep them updated. A tunnel does not replace patching, and public traffic can still reach the allowed page. No live tunnel or Cloudflare account settings are configured by this package.

## Edit and test

Edit `src/index.html`, `src/style.css`, or `src/background.js`. The downloaded human-designed icons, font, and animation library are in `src/assets`. Preserve the included asset licenses.

```bash
npm run build
npm run check
pm2 restart wacko
```

The build embeds assets and updates the script/style CSP hashes. Do not edit the compiled HTML directly. The Node server must restart after a rebuild because it keeps the page in memory.

The email link opens the visitor's mail application addressed to `contactweb@wackoxyz.org`; it does not send email through this server. Discord opens the supplied user profile. The animated background supports pointer/touch interaction, reduced-motion preferences, and a pause control.

## References

- Cloudflare dashboard tunnel setup: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/
- Cloudflare configuration: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/
- Cloudflare firewall requirements: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/
- PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
