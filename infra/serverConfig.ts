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

  // Debug logging
  console.log(
    "SSH Public Key length:",
    sshPublicKey.apply((key) => key.length),
  );
  sshPrivateKey.apply((key) =>
    console.log("SSH Private Key length:", key.length),
  );

  // Common SSH connection options
  const commonSshOptions = pulumi
    .all([publicIp, sshPrivateKey])
    .apply(([ip, key]) => ({
      host: ip,
      username: "root",
      privateKey: key,
    }));

  // Create 'codigo' user and set up SSH
  const createUser = new command.remote.Command(
    "createUser",
    {
      connection: commonSshOptions,
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
    },
    { additionalSecretOutputs: ["stdout", "stderr"] },
  );

  // Log output and errors
  createUser.stdout.apply((stdout) => {
    if (stdout) console.log("createUser stdout:", stdout);
  });
  createUser.stderr.apply((stderr) => {
    if (stderr) console.error("createUser stderr:", stderr);
  });

  // Disable root SSH access
  const disableRootSSH = new command.remote.Command(
    "disableRootSSH",
    {
      connection: commonSshOptions,
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
    { dependsOn: createUser, additionalSecretOutputs: ["stdout", "stderr"] },
  );

  disableRootSSH.stdout.apply((stdout) => {
    if (stdout) console.log("disableRootSSH stdout:", stdout);
  });
  disableRootSSH.stderr.apply((stderr) => {
    if (stderr) console.error("disableRootSSH stderr:", stderr);
  });

  // Install NVM and Node.js
  const installNode = new command.remote.Command(
    "installNode",
    {
      connection: pulumi
        .all([commonSshOptions])
        .apply(([options]) => ({ ...options, username: "codigo" })),
      create: `
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install node
        npm install -g aws-sdk
      `,
    },
    {
      dependsOn: disableRootSSH,
      additionalSecretOutputs: ["stdout", "stderr"],
    },
  );

  installNode.stdout.apply((stdout) => {
    if (stdout) console.log("installNode stdout:", stdout);
  });
  installNode.stderr.apply((stderr) => {
    if (stderr) console.error("installNode stderr:", stderr);
  });

  return { sshPrivateKey };
}
