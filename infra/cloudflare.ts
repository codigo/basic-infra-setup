import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as random from "@pulumi/random";

const config = new pulumi.Config();
const accountId = config.require("cloudflareAccountId");
const maumercadoZoneId = config.require("cloudflareMaumercadoZoneId");
const codigoZoneId = config.require("cloudflareCodigoZoneId");

interface DnsRecordArgs {
  name: string;
  zoneId: string;
  type: string;
  content: pulumi.Input<string>;
  proxied?: boolean;
}

export const createCloudflareTunnels = () => {
  // Create Cloudflare tunnel for maumercado.com
  const maumercadoTunnelSecret = new random.RandomPassword(
    "maumercado-tunnel-secret",
    {
      length: 32,
      special: false,
    },
  );

  const maumercadoTunnel = new cloudflare.Tunnel("maumercado-tunnel", {
    accountId: accountId,
    name: "maumercado-tunnel",
    secret: maumercadoTunnelSecret.result,
  });

  // Create Cloudflare tunnel for codigo.sh
  const codigoTunnelSecret = new random.RandomPassword("codigo-tunnel-secret", {
    length: 32,
    special: false,
  });

  const codigoTunnel = new cloudflare.Tunnel("codigo-tunnel", {
    accountId: accountId,
    name: "codigo-tunnel",
    secret: codigoTunnelSecret.result,
  });

  // Generate the actual tunnel tokens
  const maumercadoTunnelTokenValue = maumercadoTunnel.tunnelToken;
  const codigoTunnelTokenValue = codigoTunnel.tunnelToken;

  const dnsRecords = [
    {
      name: "dozzle",
      zoneId: codigoZoneId,
      resourceName: "codigo-dozzle",
      tunnel: codigoTunnel,
    },
    {
      name: "@",
      zoneId: maumercadoZoneId,
      resourceName: "maumercado-root",
      tunnel: maumercadoTunnel,
    },
    {
      name: "pocketbase",
      zoneId: maumercadoZoneId,
      resourceName: "maumercado-pocketbase",
      tunnel: maumercadoTunnel,
    },
    {
      name: "www",
      zoneId: maumercadoZoneId,
      resourceName: "maumercado-www",
      tunnel: maumercadoTunnel,
    },
    {
      name: "typesense",
      zoneId: maumercadoZoneId,
      resourceName: "maumercado-typesense",
      tunnel: maumercadoTunnel,
    },
    {
      name: "@",
      zoneId: codigoZoneId,
      resourceName: "codigo-root",
      tunnel: codigoTunnel,
    },
    {
      name: "www",
      zoneId: codigoZoneId,
      resourceName: "codigo-www",
      tunnel: codigoTunnel,
    },
    {
      name: "typesense",
      zoneId: codigoZoneId,
      resourceName: "codigo-typesense",
      tunnel: codigoTunnel,
    },
    {
      name: "pocketbase",
      zoneId: codigoZoneId,
      resourceName: "codigo-pocketbase",
      tunnel: codigoTunnel,
    },
  ];

  const createdRecords = dnsRecords.map(
    (record) =>
      new cloudflare.Record(
        record.resourceName,
        {
          name: record.name,
          zoneId: record.zoneId,
          type: "CNAME",
          value: record.tunnel.id.apply((id) => `${id}.cfargotunnel.com`),
          proxied: true,
        },
        {
          dependsOn: [record.tunnel],
        },
      ),
  );

  // Create Cloudflare tunnel config for maumercado.com
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
          {
            hostname: "www.maumercado.com",
            service: "http://caddy:80",
          },
          {
            hostname: "pocketbase.maumercado.com",
            service: "http://caddy:80",
          },
          {
            hostname: "typesense.maumercado.com",
            service: "http://caddy:80",
          },
          {
            service: "http_status:404",
          },
        ],
      },
    },
  );

  // Create Cloudflare tunnel config for codigo.sh
  const codigoConfig = new cloudflare.ZeroTrustTunnelCloudflaredConfig(
    "codigo-config",
    {
      accountId: accountId,
      tunnelId: codigoTunnel.id,
      config: {
        ingressRules: [
          {
            hostname: "codigo.sh",
            service: "http://caddy:80",
          },
          {
            hostname: "www.codigo.sh",
            service: "http://caddy:80",
          },
          {
            hostname: "pocketbase.codigo.sh",
            service: "http://caddy:80",
          },
          {
            hostname: "typesense.codigo.sh",
            service: "http://caddy:80",
          },
          {
            hostname: "dozzle.codigo.sh",
            service: "http://caddy:80",
          },
          {
            service: "http_status:404",
          },
        ],
      },
    },
  );

  // For maumercado.com
  const maumercadoHttpsRedirect = new cloudflare.ZoneSettingsOverride(
    "maumercado-https-redirect",
    {
      zoneId: maumercadoZoneId,
      settings: {
        alwaysUseHttps: "on",
      },
    },
  );

  // For codigo.sh
  const codigoHttpsRedirect = new cloudflare.ZoneSettingsOverride(
    "codigo-https-redirect",
    {
      zoneId: codigoZoneId,
      settings: {
        alwaysUseHttps: "on",
      },
    },
  );

  return {
    maumercadoTunnel,
    codigoTunnel,
    maumercadoTunnelTokenValue,
    codigoTunnelTokenValue,
    dnsRecords: createdRecords,
    maumercadoConfig,
    codigoConfig,
    maumercadoHttpsRedirect,
    codigoHttpsRedirect,
  };
};
