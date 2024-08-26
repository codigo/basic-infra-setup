import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function configureServer(
  server: pulumi.Output<Server>,
  publicIp: pulumi.Output<string>,
) {
  const config = new pulumi.Config();
  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");
  const encodedSshPublicKey = config.requireSecret("sshPublicKey");

  // Decode the base64-encoded public key
  const sshPublicKey = encodedSshPublicKey.apply((encoded) =>
    Buffer.from(encoded, "base64").toString("utf-8"),
  );

  // Decode the base64-encoded private key
  const sshPrivateKey = encodedSshPrivateKey.apply((encoded) =>
    Buffer.from(encoded, "base64").toString("utf-8"),
  );

  // Debug logging
  sshPublicKey.apply((key) =>
    console.log("SSH Public Key length:", key.length),
  );
  sshPrivateKey.apply((key) =>
    console.log("SSH Private Key length:", key.length),
  );

  // Common SSH connection options
  const commonSshOptions = pulumi
    .all([publicIp, sshPrivateKey])
    .apply(([ip, key]) => ({
      host: ip,
      user: "root",
      privateKey: key,
    }));

  // Create 'codigo' user and set up SSH
  const createUser = new command.remote.Command(
    "createUser",
    {
      connection: commonSshOptions,
      create: pulumi.interpolate`
      sudo useradd -m -s /bin/bash codigo
      echo "codigo ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers
      sudo mkdir -p /home/codigo/.ssh
      echo "${sshPublicKey}" | sudo tee -a /home/codigo/.ssh/authorized_keys
      sudo chown -R codigo:codigo /home/codigo/.ssh
      sudo chmod 700 /home/codigo/.ssh
      sudo chmod 600 /home/codigo/.ssh/authorized_keys
      echo "StrictHostKeyChecking no" | sudo tee /home/codigo/.ssh/config
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
      sudo sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
      sudo sed -i 's/^#PermitRootLogin/PermitRootLogin/' /etc/ssh/sshd_config
      echo "PermitRootLogin no" | sudo tee -a /etc/ssh/sshd_config
      sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
      sudo sed -i 's/^#PasswordAuthentication/PasswordAuthentication/' /etc/ssh/sshd_config
      echo "PasswordAuthentication no" | sudo tee -a /etc/ssh/sshd_config
      if command -v systemctl &> /dev/null; then
        sudo systemctl restart sshd
      else
        sudo service sshd restart || sudo service ssh restart
      fi
      sudo rm -f /root/.ssh/authorized_keys
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
    "install Node",
    {
      connection: commonSshOptions.apply((options) => ({
        ...options,
        user: "codigo",
      })),
      create: `
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
        nvm install 22 && \
        nvm alias default 22 && \
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
