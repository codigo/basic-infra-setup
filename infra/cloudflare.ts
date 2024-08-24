import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as random from "@pulumi/random";

const config = new pulumi.Config();
const accountId = config.require("cloudflareAccountId");
const maumercadoZoneId = config.require("cloudflareMaumercadoZoneId");
const codigoZoneId = config.require("cloudflareCodigoZoneId");
export function createCloudflareTunnels(serverIp: string) {
    // Create a random password for the maumercado tunnel secret
    const maumercadoTunnelSecret = new random.RandomPassword("maumercado-tunnel-secret", {
        length: 32,
        special: false,
    });

    // Create Cloudflare tunnel for maumercado.com
    const maumercadoTunnel = new cloudflare.Tunnel("maumercado-tunnel", {
        accountId: accountId,
        name: "maumercado-tunnel",
        secret: maumercadoTunnelSecret.result,
    });

    // Create DNS record for maumercado.com
    const maumercadoDns = new cloudflare.Record("maumercado-dns", {
        zoneId: maumercadoZoneId,
        name: "maumercado.com",
        type: "CNAME",
        value: maumercadoTunnel.cname,
        proxied: true,
    });

    // Create Cloudflare tunnel config for maumercado.com
    const maumercadoConfig = new cloudflare.TunnelConfig("maumercado-config", {
        accountId: accountId,
        tunnelId: maumercadoTunnel.id,
        config: {
            ingressRules: [
                {
                    hostname: "maumercado.com",
                    service: `http://${serverIp}:80`,
                },
                {
                    service: "http_status:404",
                },
            ],
        },
    });

    // Create a random password for the codigo tunnel secret
    const codigoTunnelSecret = new random.RandomPassword("codigo-tunnel-secret", {
        length: 32,
        special: false,
    });

    // Create Cloudflare tunnel for codigo.sh
    const codigoTunnel = new cloudflare.Tunnel("codigo-tunnel", {
        accountId: accountId,
        name: "codigo-tunnel",
        secret: codigoTunnelSecret.result,
    });

    // Create DNS record for codigo.sh
    const codigoDns = new cloudflare.Record("codigo-dns", {
        zoneId: codigoZoneId,
        name: "codigo.sh",
        type: "CNAME",
        value: codigoTunnel.cname,
        proxied: true,
    });

    // Create Cloudflare tunnel config for codigo.sh
    const codigoConfig = new cloudflare.TunnelConfig("codigo-config", {
        accountId: accountId,
        tunnelId: codigoTunnel.id,
        config: {
            ingressRules: [
                {
                    hostname: "codigo.sh",
                    service: `http://${serverIp}:80`,
                },
                {
                    service: "http_status:404",
                },
            ],
        },
    });

    return {
        maumercadoTunnel,
        maumercadoDns,
        codigoTunnel,
        codigoDns,
    };
}
