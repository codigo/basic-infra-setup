# Caddy in This Project

## Overview

Caddy is a powerful, enterprise-ready, open-source web server with automatic HTTPS written in Go. In this project, Caddy is used as a reverse proxy server to manage and route incoming HTTP requests to various backend services. It simplifies the process of managing multiple domains and services, providing a unified interface for handling requests.

## Setup and Configuration

### Caddyfile

The `Caddyfile` is the configuration file for Caddy, which defines how Caddy should handle incoming requests. Here's a breakdown of the configuration used in this project:

```caddyfile
{
 auto_https off
 admin off
 email mau@codigo.sh
}
```

- **auto_https off**: Disables automatic HTTPS. This might be necessary if you are handling SSL termination elsewhere or using a custom setup.
- **admin off**: Disables the admin interface, which is useful for security reasons in certain environments.
- **email**: Specifies the email address for notifications and certificate management.

### Reverse Proxy Configuration

The Caddyfile contains several reverse proxy configurations, each handling requests for different hostnames:

```caddyfile
:80 {
 @codigo_and_maumercado host codigo.sh www.codigo.sh maumercado.com www.maumercado.com
 handle @codigo_and_maumercado {
  reverse_proxy mau-app-codigo:3000 {
   // Headers configuration
  }
 }

 // Additional reverse proxy configurations for other services
}
```

- **@codigo_and_maumercado**: A named matcher that specifies the hostnames for which this block should handle requests.
- **reverse_proxy**: Directs incoming requests to the specified backend service (`mau-app-codigo:3000` in this case).
- **header_up**: Sets headers to be sent to the backend service, such as `X-Forwarded-For`, `X-Forwarded-Proto`, and others. These headers are crucial for maintaining information about the original request.

### Docker Compose Configuration

Caddy is deployed using Docker Compose, which simplifies the management of containerized applications. Here's a snippet from the `docker-compose.tooling.yaml` file:

```yaml
services:
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /home/codigo/tooling/data/caddy/data:/data
      - /home/codigo/tooling/data/caddy/config:/config
      - /home/codigo/tooling/data/caddy/Caddyfile:/etc/caddy/Caddyfile
    networks:
      - caddy_net
    healthcheck:
      test: ["CMD", "caddy", "validate", "--config", "/etc/caddy/Caddyfile"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

- **image**: Specifies the Docker image for Caddy.
- **ports**: Maps the host ports to the container ports, allowing external access to the Caddy server.
- **volumes**: Mounts the Caddyfile and other necessary directories into the container.
- **networks**: Connects the Caddy service to a Docker network (`caddy_net`), allowing it to communicate with other services.
- **healthcheck**: Ensures that the Caddy service is running correctly by periodically validating the configuration.

## Conclusion

Caddy is a versatile tool in this project, providing a robust solution for managing HTTP requests and routing them to appropriate backend services. Its configuration is straightforward, leveraging the simplicity of the Caddyfile and the power of Docker Compose to ensure a reliable and maintainable setup.
