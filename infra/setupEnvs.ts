import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";
import { Bucket } from "@pulumi/aws/s3";

export const configureServerEnv = (server: Server, appBucket: Bucket) => {
  const config = new pulumi.Config();
  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

  const sshPrivateKey = encodedSshPrivateKey.apply((encoded) =>
    Buffer.from(encoded, "base64").toString("utf-8"),
  );

  const createEnvVars = new command.remote.Command("createEnvVars", {
    connection: pulumi
      .all([server.ipv4Address, sshPrivateKey])
      .apply(([ip, key]) => ({
        host: ip,
        user: "codigo",
        privateKey: key,
      })),
    create: pulumi
      .all([
        config.requireSecret("awsAccessKeyId"),
        config.requireSecret("awsSecretAccessKey"),
        config.require("backupDir"),
        new pulumi.Config("aws").require("region"),
        appBucket.bucket,
      ])
      .apply(
        ([awsAccessKeyId, awsSecretAccessKey, backupDir, awsRegion, bucketName]) => `
      # Remove old env vars to avoid duplicates
      sed -i '/^export AWS_ACCESS_KEY_ID=/d' /home/codigo/.bashrc
      sed -i '/^export AWS_SECRET_ACCESS_KEY=/d' /home/codigo/.bashrc
      sed -i '/^export AWS_REGION=/d' /home/codigo/.bashrc
      sed -i '/^export BACKUP_DIR=/d' /home/codigo/.bashrc
      sed -i '/^export APP_BUCKET=/d' /home/codigo/.bashrc

      echo "export AWS_ACCESS_KEY_ID=${awsAccessKeyId}" >> /home/codigo/.bashrc
      echo "export AWS_SECRET_ACCESS_KEY=${awsSecretAccessKey}" >> /home/codigo/.bashrc
      echo "export AWS_REGION=${awsRegion}" >> /home/codigo/.bashrc
      echo "export BACKUP_DIR=${backupDir}" >> /home/codigo/.bashrc
      echo "export APP_BUCKET=${bucketName}" >> /home/codigo/.bashrc
    `,
      ),
  });

  return {
    createEnvVars,
  };
};
