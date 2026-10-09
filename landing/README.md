# b2-esports.com

Start page of the domain and the nginx configuration that serves it together with the
stats app under `/stats`.

- `site/` – the start page: one HTML file plus pictures, no build step
- `nginx/b2-esports.com.conf` – nginx site for the domain

## Putting it online

1. DNS: point `b2-esports.com` and `www.b2-esports.com` at this server (in Cloudflare).
2. Start page and nginx site (as root):

   ```
   mkdir -p /var/www/b2-esports.com
   cp landing/site/* /var/www/b2-esports.com/
   cp landing/nginx/b2-esports.com.conf /etc/nginx/sites-available/b2-esports.com
   ln -s /etc/nginx/sites-available/b2-esports.com /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```

3. HTTPS certificate; certbot extends the nginx site by itself:

   ```
   certbot --nginx -d b2-esports.com -d www.b2-esports.com
   ```

4. Move the stats app to `/stats`: in `.env` set

   ```
   BASE_PATH=/stats
   AUTH_URL="https://b2-esports.com/api/auth"
   TMIO_USER_AGENT="B2 Stats (b2-esports.com/stats; <contact>)"
   ```

   then `docker compose up -d`. From then on the app only answers under the new address;
   everyone signs in again. (The production image fixes the path when it is built:
   `docker compose -f docker-compose.yml build --build-arg BASE_PATH=/stats`.)

5. Old address: remove the `location /b2-stats { ... }` block from
   `/etc/nginx/sites-available/reh-netsolutions.cc` and reload nginx.

After changing the start page, copy `landing/site/*` to `/var/www/b2-esports.com/` again.
