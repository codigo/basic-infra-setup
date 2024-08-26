import * as pulumi from "@pulumi/pulumi";
import { createS3Bucket } from "./infra/s3";
import { createIAMResources } from "./infra/iam";
import { createHetznerServer } from "./infra/hetznerServer";
import { configureServer } from "./infra/serverConfig";
import { copyToolingDataFilesToServer } from "./infra/serverCopyToolingFiles";
import { copyMauAppDataFilesToServer } from "./infra/serverCopyMauAppFiles";
import { configureServerEnv } from "./infra/setupEnvs";
import { deployDockerStacks } from "./infra/deployDockerStacks";
import { createCloudflareTunnels } from "./infra/cloudflare";

// Create S3 buckets
const { appBucket } = createS3Bucket();

// Create IAM resources
const { iamUser, accessKey } = createIAMResources();

// Create Hetzner server
const { server, publicIp } = createHetznerServer();

// Configure server
const configuredServer = publicIp.apply((ip) =>
  configureServer(server, pulumi.output(ip)),
);

// Copy tooling data files to server
const toolingFilesCopied = configuredServer.apply(() =>
  copyToolingDataFilesToServer(server, publicIp),
);

// Configure server environment variables
const envConfigured = toolingFilesCopied.apply(() =>
  configureServerEnv(server, publicIp, appBucket),
);

// Copy Mau App data files to server
const mauAppFilesCopied = envConfigured.apply(() =>
  copyMauAppDataFilesToServer(server, publicIp),
);

// Deploy docker stacks
const dockerStacksDeployed = mauAppFilesCopied.apply(() =>
  deployDockerStacks(server, publicIp),
);

// Create Cloudflare tunnels
const cloudflareTunnels = dockerStacksDeployed.apply(() =>
  createCloudflareTunnels(publicIp),
);

// Export important values
export const serverId = server.id;
export const serverIp = publicIp;
export const appBucketName = appBucket.id;
export const iamUserName = iamUser.name;
export const iamAccessKeyId = accessKey.id;
export const iamSecretAccessKey = accessKey.secret;
export const maumercadoTunnelId = cloudflareTunnels.apply(
  (tunnels) => tunnels.maumercadoTunnel.id,
);
export const maumercadoDnsId = cloudflareTunnels.apply(
  (tunnels) => tunnels.maumercadoDns.id,
);
export const codigoTunnelId = cloudflareTunnels.apply(
  (tunnels) => tunnels.codigoTunnel.id,
);
export const codigoDnsId = cloudflareTunnels.apply(
  (tunnels) => tunnels.codigoDns.id,
);
