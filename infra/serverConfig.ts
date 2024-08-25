import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function configureServer(
  server: pulumi.Output<Server>,
  publicIp: pulumi.Output<string>,
) {
  const config = new pulumi.Config();
  const sshPrivateKey = config.requireSecret("sshPrivateKey");
  const encodedSshPublicKey = config.requireSecret("sshPublicKey");

  // Decode the base64-encoded public key
  const sshPublicKey = pulumi
    .all([encodedSshPublicKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  // Create 'codigo' user and set up SSH
  const createUser = new command.remote.Command("createUser", {
    connection: {
      host: publicIp,
      user: "root",
      privateKey: sshPrivateKey,
    },
    create: pulumi.interpolate`
            useradd -m -s /bin/bash codigo
            echo "codigo ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
            mkdir -p /home/codigo/.ssh
            echo "${sshPublicKey}" >> /home/codigo/.ssh/authorized_keys
            chown -R codigo:codigo /home/codigo/.ssh
            chmod 700 /home/codigo/.ssh
            chmod 600 /home/codigo/.ssh/authorized_keys
            echo "StrictHostKeyChecking no" > /home/codigo/.ssh/config
        `,
  });

  // Disable root SSH access
  const disableRootSSH = new command.remote.Command(
    "disableRootSSH",
    {
      connection: {
        host: publicIp,
        user: "root",
        privateKey: sshPrivateKey,
      },
      create: `
            sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
            sed -i 's/^#PermitRootLogin/PermitRootLogin/' /etc/ssh/sshd_config
            echo "PermitRootLogin no" >> /etc/ssh/sshd_config
            sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
            sed -i 's/^#PasswordAuthentication/PasswordAuthentication/' /etc/ssh/sshd_config
            echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
            systemctl restart sshd
            rm -f /root/.ssh/authorized_keys
        `,
    },
    { dependsOn: createUser },
  );

  // Install NVM and Node.js
  const installNode = new command.remote.Command(
    "installNode",
    {
      connection: {
        host: publicIp,
        user: "codigo",
        privateKey: sshPrivateKey,
      },
      create: `
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
            source ~/.nvm/nvm.sh && nvm install node && npm install -g aws-sdk
        `,
    },
    { dependsOn: disableRootSSH },
  );

  return { sshPrivateKey };
}
