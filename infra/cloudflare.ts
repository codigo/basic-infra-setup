import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as random from "@pulumi/random";

const config = new pulumi.Config();
const accountId = config.require("cloudflareAccountId");
const maumercadoZoneId = config.require("cloudflareMaumercadoZoneId");
const codigoZoneId = config.require("cloudflareCodigoZoneId");

export const createCloudflareTunnels = (serverIp: pulumi.Output<string>) => {
  // Create a random password for the maumercado tunnel secret
  const maumercadoTunnelSecret = new random.RandomPassword(
    "maumercado-tunnel-secret",
    {
      length: 32,
      special: false,
    },
  );

  // Create Cloudflare tunnel for maumercado.com
  const maumercadoTunnel = new cloudflare.ZeroTrustTunnelCloudflared(
    "maumercado-tunnel",
    {
      accountId: accountId,
      name: "maumercado-tunnel",
      secret: maumercadoTunnelSecret.result,
    },
  );

  // Create a random password for the codigo tunnel secret
  const codigoTunnelSecret = new random.RandomPassword("codigo-tunnel-secret", {
    length: 32,
    special: false,
  });

  // Create Cloudflare tunnel for codigo.sh
  const codigoTunnel = new cloudflare.ZeroTrustTunnelCloudflared(
    "codigo-tunnel",
    {
      accountId: accountId,
      name: "codigo-tunnel",
      secret: codigoTunnelSecret.result,
    },
  );

  // Helper function to create or update DNS records
  function createDnsRecord(
    resourceName: string,
    name: string,
    zoneId: string,
    type: string,
    content: pulumi.Output<string>,
    proxied: boolean = true,
  ) {
    return new cloudflare.Record(
      resourceName,
      {
        zoneId: zoneId,
        name: name,
        type: type,
        content: content,
        proxied: proxied,
      },
      { deleteBeforeReplace: true },
    );
  }

  // Maumercado.com DNS records
  const maumercadoDns = createDnsRecord(
    "maumercado-root",
    "maumercado.com",
    maumercadoZoneId,
    "CNAME",
    maumercadoTunnel.cname,
  );
  const wwwMaumercadoDns = createDnsRecord(
    "maumercado-www",
    "www",
    maumercadoZoneId,
    "A",
    serverIp,
  );
  const maumercadoPocketbaseDns = createDnsRecord(
    "maumercado-pocketbase",
    "pocketbase",
    maumercadoZoneId,
    "A",
    serverIp,
  );
  const maumercadoTypesenseDns = createDnsRecord(
    "maumercado-typesense",
    "typesense",
    maumercadoZoneId,
    "A",
    serverIp,
  );

  // Codigo.sh DNS records
  const codigoDns = createDnsRecord(
    "codigo-root",
    "codigo.sh",
    codigoZoneId,
    "CNAME",
    codigoTunnel.cname,
  );
  const wwwCodigoDns = createDnsRecord(
    "codigo-www",
    "www",
    codigoZoneId,
    "A",
    serverIp,
  );

  // Additional service DNS records
  const codigoPocketbaseDns = createDnsRecord(
    "codigo-pocketbase",
    "pocketbase",
    codigoZoneId,
    "A",
    serverIp,
  );
  const codigoTypesenseDns = createDnsRecord(
    "codigo-typesense",
    "typesense",
    codigoZoneId,
    "A",
    serverIp,
  );
  const dozzleDns = createDnsRecord(
    "codigo-dozzle",
    "dozzle",
    codigoZoneId,
    "A",
    serverIp,
  );

  // Create Cloudflare tunnel config for maumercado.com
  const maumercadoConfig = new cloudflare.ZeroTrustTunnelCloudflaredConfig(
    "maumercado-config",
    {
      accountId: accountId,
      tunnelId: maumercadoTunnel.id,
      config: pulumi.all([serverIp]).apply(([ip]) => ({
        ingressRules: [
          {
            hostname: "maumercado.com",
            service: `http://${ip}:80`,
          },
          {
            hostname: "www.maumercado.com",
            service: `http://${ip}:80`,
          },
          {
            hostname: "pocketbase.maumercado.com",
            service: `http://${ip}:80`,
          },
          {
            hostname: "typesense.maumercado.com",
            service: `http://${ip}:80`,
          },
          {
            service: "http_status:404",
          },
        ],
      })),
    },
  );

  // Create Cloudflare tunnel config for codigo.sh
  const codigoConfig = new cloudflare.ZeroTrustTunnelCloudflaredConfig(
    "codigo-config",
    {
      accountId: accountId,
      tunnelId: codigoTunnel.id,
      config: pulumi.all([serverIp]).apply(([ip]) => ({
        ingressRules: [
          {
            hostname: "codigo.sh",
            service: `http://${ip}:80`,
          },
          {
            hostname: "www.codigo.sh",
            service: `http://${ip}:80`,
          },
          {
            hostname: "pocketbase.codigo.sh",
            service: `http://${ip}:80`,
          },
          {
            hostname: "typesense.codigo.sh",
            service: `http://${ip}:80`,
          },
          {
            hostname: "dozzle.codigo.sh",
            service: `http://${ip}:80`,
          },
          {
            service: "http_status:404",
          },
        ],
      })),
    },
  );

  // Create a rule to always use HTTPS for maumercado
  const maumercadoHttpsRule = new cloudflare.Ruleset("maumercado-https-rule", {
    zoneId: maumercadoZoneId,
    name: "maumercado-https-rule",
    kind: "zone",
    phase: "http_request_redirect",
    rules: [
      {
        action: "redirect",
        expression: "true",  // This will apply to all requests
        actionParameters: {
          statusCode: 301,
          uri: {
            origin: true,
            path: {
              value: "{uri.path}",
            },
            query: {
              value: "{uri.query}",
            },
          },
        },
      },
    ],
  });

  // Create a rule to always use HTTPS for codigo.sh
  const codigoHttpsRule = new cloudflare.Ruleset("codigo-https-rule", {
    zoneId: codigoZoneId,
    name: "codigo-https-rule",
    kind: "zone",
    phase: "http_request_redirect",
    rules: [
      {
        action: "redirect",
        expression: "true",  // This will apply to all requests
        actionParameters: {
          statusCode: 301,
          uri: {
            origin: true,
            path: {
              value: "{uri.path}",
            },
            query: {
              value: "{uri.query}",
            },
          },
        },
      },
    ],
  });

  return {
    maumercadoTunnel,
    maumercadoDns,
    wwwMaumercadoDns,
    maumercadoPocketbaseDns,
    maumercadoTypesenseDns,
    codigoTunnel,
    codigoDns,
    wwwCodigoDns,
    codigoPocketbaseDns,
    codigoTypesenseDns,
    dozzleDns,
    maumercadoConfig,
    codigoConfig,
    maumercadoHttpsRule,
    codigoHttpsRule,
  };
};
