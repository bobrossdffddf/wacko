# Wacko

One self-contained page. The website listens on `192.168.68.58:3000` and permits direct connections from `192.168.68.0/24` plus local loopback. No tunnel IP is required. Cloudflared can run on another VM in the same subnet.

## Replace the existing installation

Copy the contents of the downloaded `wacko-portfolio` folder into `/root/wacko`, replacing the previous files. Do not put the new folder inside the old one. Remove the obsolete Caddyfile if it remains from an earlier installation.

On the website VM:

```bash
cd /root/wacko
pm2 delete wacko
pm2 start ecosystem.config.cjs
pm2 save
ss -ltnp | grep ':3000'
```

The delete command removes only the old PM2 process registration, not the site files. This prevents stale process settings from preserving the old launcher. If no process named wacko exists, skip that command.

Now open `http://192.168.68.58:3000` from a device on the same `192.168.68.x` network. That network is assumed to use a `/24` mask. If yours differs, change ALLOWED_SUBNET in the ecosystem file. Changing HOST also requires choosing an address actually assigned to the web VM.

The dedicated `start.mjs` entry point starts the listener when imported by PM2. The server module can still be imported safely by tests.

## New installation

Install an up-to-date Node.js 24 LTS or newer supported LTS, npm, and PM2 in the web VM. The application has no npm dependencies and includes its compiled page.

```bash
npm install --ignore-scripts
npm install --global pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Run the system startup command printed by PM2 and save again. A non-root service account is preferable for a fresh install. `npm start` also starts the app directly; do not run it while PM2 already owns port 3000.

## Cloudflare Tunnel

On the separate tunnel VM, set the published application's HTTP service to `192.168.68.58:3000`. The full origin URL is `http://192.168.68.58:3000`. Use your chosen public hostname and leave the path field blank. The application itself only serves `/`.

Enable HTTPS for visitors at Cloudflare. The VM-to-VM hop is ordinary HTTP over your private LAN. Keep it on a trusted network and do not forward TCP 3000 on your router. Tunnel credentials must remain on the tunnel VM, outside the website project.

If you use a locally managed tunnel, `cloudflared.example.yml` maps the root path to the web VM and rejects unmatched paths. Replace the tunnel UUID, credential path, and hostname placeholders; validate the installed configuration with `cloudflared tunnel ingress validate`.

The application allows the tunnel VM as a LAN peer. People visiting your public Cloudflare hostname can still see the site; this LAN restriction is an origin restriction, not visitor authentication.

If a VM or Proxmox firewall is enabled, it must permit TCP 3000 from `192.168.68.0/24`. Keep other sources blocked. Do not reset or flush existing firewall rules.

Disable script rewriting/injection such as Rocket Loader or injected analytics for the hostname. The Content Security Policy only allows the page's exact bundled scripts and styles.

## Fail2Ban

A Debian/Ubuntu setup script and SSH jail are included. Run on the website VM:

```bash
bash setup-fail2ban.sh
fail2ban-client status sshd
```

Run with sudo if you are not root. The script installs Fail2Ban and its systemd journal support, validates the configuration, and enables the service. The SSH jail bans a source for 10 minutes after 5 failed authentication attempts within 10 minutes. It uses SSH port 22 (`port = ssh`); change that setting before installation if your SSH daemon uses a different port. Localhost is exempt. An unban command is `fail2ban-client set sshd unbanip CLIENT_IP`.

This protects SSH authentication on the VM. It does not ban website visitors or scan HTTP paths. A firewall-level website ban could otherwise block the shared cloudflared connector rather than an individual remote visitor. Use Cloudflare's edge controls for public web traffic if needed. Neither Fail2Ban installation nor firewall changes have been executed on your VM by this package.

## Public application surface

- Only GET and HEAD on `/` return the page. Query strings are ignored and never reflected.
- All other valid paths return 404; malformed paths return 400. Other HTTP methods are rejected.
- Icons, fonts, CSS, animation, and asset credits are embedded. There are no asset endpoints, APIs, admin routes, health checks, uploads, forms, accounts, database, or analytics.
- Direct clients outside the configured LAN are rejected based on the actual socket address. Forwarding headers cannot bypass this check.
- Scripts and styles are CSP hash-pinned. No unsafe-inline, unsafe-eval, remote resources, or background browser connections are allowed.
- Request size, time, and connection limits remain in place, with framing, MIME-sniffing, and browser-permission restrictions.

Zero attack surface cannot be guaranteed. Keep Node, PM2, cloudflared, Fail2Ban, and the OS patched.

## Edit and verify

Edit the files under `src/`, then:

```bash
npm run build
npm run check
pm2 restart wacko
```

The build embeds assets and regenerates CSP hashes. Restart after a build because the server loads the page into memory at startup. Preserve the asset licenses. Credits expand within the page, without an additional route.

## References

- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/
- PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
- Fail2Ban jail settings: https://github.com/fail2ban/fail2ban/blob/master/config/jail.conf
