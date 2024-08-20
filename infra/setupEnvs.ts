import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";
import { Bucket } from "@pulumi/aws/s3";

export function configureServerEnv(server: pulumi.Output<Server>, publicIp: pulumi.Output<string>, appBucket: pulumi.Output<Bucket>) {
  const config = new pulumi.Config();
  const sshPrivateKey = config.requireSecret("sshPrivateKey");

  // Create necessary environment variables in the server
  const createEnvVars = new command.remote.Command("createEnvVars", {
    connection: {
      host: publicIp,
      user: "codigo",
      privateKey: sshPrivateKey
    },
    create: `
      echo "export AWS_ACCESS_KEY_ID=${config.requireSecret("awsAccessKeyId")}" >> /home/codigo/.bashrc
      echo "export AWS_SECRET_ACCESS_KEY=${config.requireSecret("awsSecretAccessKey")}" >> /home/codigo/.bashrc
      echo "export BACKUP_DIR=${config.require("backupDir")}" >> /home/codigo/.bashrc
      echo "export APP_BUCKET=${appBucket.bucket}" >> /home/codigo/.bashrc
    `
  });

}
