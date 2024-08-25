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
configureServer(server, publicIp);

// Copy tooling data files to server
copyToolingDataFilesToServer(server, publicIp);

// Configure server environment variables
configureServerEnv(server, publicIp, appBucket);

// Copy Mau App data files to server
copyMauAppDataFilesToServer(server, publicIp);

// Deploy docker stacks
deployDockerStacks(server, publicIp);

// Create Cloudflare tunnels
const { maumercadoTunnel, maumercadoDns, codigoTunnel, codigoDns } =
  createCloudflareTunnels(publicIp);

// Export important values
export const serverId = server.id;
export const serverIp = publicIp;
export const appBucketName = appBucket.id;
export const iamUserName = iamUser.name;
export const iamAccessKeyId = accessKey.id;
export const iamSecretAccessKey = accessKey.secret;
export const maumercadoTunnelId = maumercadoTunnel.id;
export const maumercadoDnsId = maumercadoDns.id;
export const codigoTunnelId = codigoTunnel.id;
export const codigoDnsId = codigoDns.id;
