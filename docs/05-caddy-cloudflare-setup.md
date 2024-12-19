# Understanding the Mau App Infrastructure Project: Part 5 - Caddy and Cloudflare Setup

In this part, we'll explore how we set up Caddy as a reverse proxy and integrate Cloudflare for enhanced security and performance.

## Caddy Setup

Caddy is an open-source web server with automatic HTTPS. We use it as a reverse proxy to route requests to our various services. Here's how we configure Caddy in our project:

1. **Caddyfile**: The Caddy configuration is defined in `tooling/data/caddy/Caddyfile`:

   ```caddyfile
   {
     auto_https off
     admin off
     email mau@codigo.sh
   }

   :80 {
     @codigo_and_maumercado host codigo.sh www.codigo.sh maumercado.com www.maumercado.com
     handle @codigo_and_maumercado {
       reverse_proxy mau-app-codigo:3000 {
         # ... header configurations ...
       }
     }

     # ... other route configurations ...
   }
   ```

   This configuration sets up Caddy to listen on port 80 and route requests to different services based on the hostname.

2. **Docker Compose**: Caddy is deployed as a Docker service in `docker-compose.tooling.yaml`:

   ```yaml
   services:
     caddy:
       image: caddy:2
       deploy:
         replicas: 1
         restart_policy:
           condition: any
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - /home/codigo/tooling/data/caddy/data:/data
         - /home/codigo/tooling/data/caddy/config:/config
         - /home/codigo/tooling/data/caddy/Caddyfile:/etc/caddy/Caddyfile
       networks:
         - caddy_net
   ```

## Cloudflare Integration

We use Cloudflare for DNS management, DDoS protection, and as a reverse proxy. Here's how we set it up:

1. **Tunnel Creation**: We create Cloudflare tunnels in `infra/cloudflare.ts`:

   ```typescript
   const maumercadoTunnel = new cloudflare.Tunnel("maumercado-tunnel", {
     accountId: accountId,
     name: "maumercado-tunnel",
     secret: maumercadoTunnelSecret.result,
   });

   const codigoTunnel = new cloudflare.Tunnel("codigo-tunnel", {
     accountId: accountId,
     name: "codigo-tunnel",
     secret: codigoTunnelSecret.result,
   });
   ```

2. **DNS Configuration**: We set up DNS records to point to our Cloudflare tunnels:

   ```typescript
   const createdRecords = dnsRecords.map(
     (record) =>
       new cloudflare.Record(
         record.resourceName,
         {
           name: record.name,
           zoneId: record.zoneId,
           type: "CNAME",
           content: record.tunnel.id.apply((id) => `${id}.cfargotunnel.com`),
           proxied: true,
         },
         {
           dependsOn: [record.tunnel],
         },
       ),
   );
   ```

3. **Tunnel Configuration**: We configure the Cloudflare tunnels to route traffic to our Caddy server:

   ```typescript
   const maumercadoConfig = new cloudflare.ZeroTrustTunnelCloudflaredConfig(
     "maumercado-config",
     {
       accountId: accountId,
       tunnelId: maumercadoTunnel.id,
       config: {
         ingressRules: [
           {
             hostname: "maumercado.com",
             service: "http://caddy:80",
           },
           // ... other rules ...
         ],
       },
     },
   );
   ```

## Benefits of This Setup

1. **Automatic HTTPS**: Caddy handles SSL/TLS certificate management automatically.
2. **Simplified Routing**: Caddy makes it easy to route requests to different services based on hostnames or paths.
3. **DDoS Protection**: Cloudflare provides protection against DDoS attacks.
4. **Performance**: Cloudflare's global CDN can improve the performance of our application for users around the world.
5. **Security**: Cloudflare tunnels provide a secure way to expose our services to the internet without opening ports on our server.

## Next Steps

In the next part, we'll explore how we set up our application services, including PocketBase for database management. We'll look at how these services are configured and integrated into our overall infrastructure.

Understanding how to set up a reverse proxy like Caddy and integrate with a service like Cloudflare is crucial for building secure and performant web applications. This setup provides a solid foundation for routing traffic to our services while benefiting from Cloudflare's security and performance features.
