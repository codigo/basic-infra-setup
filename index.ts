import * as pulumi from "@pulumi/pulumi";
import { createS3Bucket } from "./infra/s3";
import { createIAMResources } from "./infra/iam";
import { configureServer } from "./infra/serverConfig";
import { setupDockerInServer } from "./infra/setupDockerInServer";
import { copyToolingDataFilesToServer } from "./infra/serverCopyToolingFiles";
import { copyMauAppDataFilesToServer } from "./infra/serverCopyMauAppFiles";
import { configureServerEnv } from "./infra/setupEnvs";
import { deployDockerStacks } from "./infra/deployDockerStacks";
import { createCloudflareTunnels } from "./infra/cloudflare";
import { ServerProvider } from "./infra/serverProvider";
import { HetznerProvider } from "./infra/hetznerProvider"; // or import DigitalOceanProvider

// Instantiate the desired server provider
const serverProvider: ServerProvider = new HetznerProvider(); // or new DigitalOceanProvider()

// Step 1-4: Create S3 bucket, IAM resources, server, and Cloudflare tunnels in parallel
const s3Resources = createS3Bucket();
const iamResources = createIAMResources();
const serverResources = serverProvider.createServer(
  new pulumi.Config().require("appName"),
  new pulumi.Config().requireSecret("sshPublicKey"),
);
const cloudflareResources = createCloudflareTunnels();

// Wait for all parallel operations to complete
const initialSetup = pulumi
  .all([s3Resources, iamResources, serverResources, cloudflareResources])
  .apply(([s3, iam, server, cloudflare]) => ({
    appBucket: s3.appBucket,
    bucketUrl: s3.bucketUrl,
    iamUser: iam.iamUser,
    accessKey: iam.accessKey,
    server: server.server,
    sshKey: server.sshKey,
    cloudflare: cloudflare,
  }));

// Step 5: Configure server (depends on server creation)
const serverConfig = initialSetup.apply((resources) => {
  const { createUser, installNode, disableRootSSH } = configureServer(
    resources.server,
  );
  return pulumi.all([createUser.id, installNode.id, disableRootSSH.id]);
});

// Add this step to configure server environment
const serverEnv = pulumi
  .all([initialSetup, serverConfig])
  .apply(([resources, _]) => {
    return configureServerEnv(resources.server, resources.appBucket);
  });

// Step 6: Set up Docker in server (depends on server configuration and Cloudflare setup)
const setupDocker = pulumi
  .all([initialSetup, serverConfig, serverEnv])
  .apply(([resources]) => {
    const {
      installDocker,
      initDockerSwarm,
      createDockerNetworks,
      setupSecrets,
    } = setupDockerInServer(resources.server);
    return pulumi.all([
      installDocker.id,
      initDockerSwarm.id,
      createDockerNetworks.id,
      setupSecrets.id,
    ]);
  });

// Step 7: Copy Mau App files and tooling files in parallel (depends on server environment setup)
const filesCopied = pulumi
  .all([initialSetup, serverEnv, setupDocker])
  .apply(([resources, _, __]) => {
    const server = resources.server;
    const mauAppFiles = copyMauAppDataFilesToServer(server);
    const toolingFiles = copyToolingDataFilesToServer(
      server,
      resources.cloudflare.maumercadoTunnel.tunnelToken,
      resources.cloudflare.codigoTunnel.tunnelToken,
    );

    return pulumi.all([
      mauAppFiles.createMauAppFolders.id,
      mauAppFiles.scpDockerComposeMauApp.id,
      toolingFiles.scpDockerComposeTooling.id,
      toolingFiles.scpToolingDataDozzle.id,
      toolingFiles.scpCaddyFile.id,
      toolingFiles.setPermissionsAndCronJob.id,
    ]);
  });

// Step 8: Deploy Docker stacks (depends on file copying)
const dockerStacksDeployed = pulumi
  .all([initialSetup, filesCopied, serverEnv])
  .apply(([resources, _]) => {
    const server = resources.server;
    const { deployDockerStacksResult } = deployDockerStacks(server);
    return deployDockerStacksResult.id;
  });

// Exports
export const serverIp = initialSetup.apply(
  (resources) => resources.server.ipv4Address,
);
export const bucketName = initialSetup.apply(
  (resources) => resources.appBucket.id,
);
export const iamUserName = initialSetup.apply(
  (resources) => resources.iamUser.name,
);
export const accessKeyId = initialSetup.apply(
  (resources) => resources.accessKey.id,
);
export const sshKeyId = initialSetup.apply((resources) => resources.sshKey.id);
export const initialSetupComplete = initialSetup.apply(
  () => "Parallel setup completed",
);
export const serverConfigOutput = serverConfig;
export const serverEnvOutput = serverEnv;
export const filesCopiedOutput = filesCopied;
export const dockerStacksDeployedOutput = dockerStacksDeployed;
export const cloudflareSetupOutput = cloudflareResources;
