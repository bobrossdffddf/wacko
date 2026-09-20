# Wacko

A single-page portfolio. Plain HTML and CSS, locally hosted assets, and a Node server with no application dependencies or build step.

## Run

Use an up-to-date Node.js 24 LTS release or newer supported LTS. Inside the extracted `wacko-portfolio` folder:

```bash
npm install --ignore-scripts
npm start
```

Open http://127.0.0.1:3000 on the same machine. The default listener is localhost. For a temporary LAN preview in your VM or container:

```bash
HOST=0.0.0.0 npm start
```

Open `http://YOUR_CONTAINER_IP:3000` from the LAN. Stop this preview before starting PM2. Keep the production app on localhost behind your HTTPS proxy.

## Proxmox + PM2

Use a Debian/Ubuntu guest VM or unprivileged LXC on Proxmox. Run this as a normal user in the guest, rather than on the Proxmox management host. Install a supported Node LTS and npm first.

```bash
cd wacko-portfolio
npm install --ignore-scripts
npm install --global pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Run the specific system startup command printed by `pm2 startup`, then run `pm2 save` again. PM2 binds the application to `127.0.0.1:3000` by default. Use a user-owned Node installation for the global PM2 install.

```bash
pm2 status
pm2 logs wacko --lines 30
pm2 restart wacko
```

Restart after editing files because the server loads its public files into memory at startup.

## HTTPS with Caddy

The included `Caddyfile` is for Caddy running in the same guest as the app. Install Caddy using its official instructions. Replace `{$SITE_DOMAIN}` with your actual domain, then install the file as `/etc/caddy/Caddyfile`. Alternatively, supply `SITE_DOMAIN` in Caddy's service environment.

Point your domain's DNS to your public IP and forward TCP ports 80 and 443 to this guest. Allow those ports through the guest firewall. Keep port 3000 and the Proxmox management interface private.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtains and renews HTTPS certificates when DNS and incoming traffic are configured correctly. The provided configuration adds HSTS and proxies to the localhost Node listener. If your proxy is in another guest, bind Node to the web guest's private IP and allow port 3000 only from that proxy; update the proxy upstream accordingly.

## Security

- No forms, accounts, uploads, analytics, cookies, database, or application npm dependencies. The only browser JavaScript is the locally bundled particles.js background and its configuration.
- Exact public-file allowlist. Server source, configuration, environment files, and arbitrary paths cannot be downloaded through the server.
- Only GET and HEAD are accepted. Encoded paths, traversal attempts, overlong URLs, and request bodies are rejected.
- Restrictive Content Security Policy, frame protection, MIME sniffing protection, no referrer, restricted browser permissions, and cross-origin opener/resource protections.
- Bounded connection count, header size, request timeouts, and requests per socket.
- External links use `noopener noreferrer`. Icons, font, and background scripts are served locally. Inline scripts, eval, and outbound script connections are blocked.
- HSTS is set at the HTTPS proxy, not on plain HTTP responses.

These controls reduce the site's attack surface; they do not protect an unpatched guest, leaked SSH credentials, compromised dependencies in the hosting stack, or a volumetric DDoS attack. Keep Node, PM2, Caddy, and the guest OS updated. Infrastructure security still depends on your configuration.

Run the included HTTP security tests:

```bash
npm run check
```

## Edit

- `dist/index.html`: text and links.
- `dist/style.css`: layout and styling.
- `dist/assets/`: downloaded icons, font, and particles.js.
- `server.mjs`: public route allowlist and HTTP controls.
- `ecosystem.config.cjs`: process settings.

Discord opens the supplied user profile. Email me opens the visitor's email application addressed to contactweb@wackoxyz.org. No account lookup or verification is claimed.

The background responds to pointer movement and touch, pauses when the tab is hidden, and respects reduced-motion preferences. The footer control can pause or resume it.

Asset attribution is in `dist/credits.txt`, also linked from the page. Preserve the asset licenses included in this package.

## References

- PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
- Caddy: https://caddyserver.com/docs/quick-starts/reverse-proxy
- Header guidance: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
# wacko
