import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const configureServer = (server: Server) => {
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
    .all([server.ipv4Address, sshPrivateKey])
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
      set -e
      echo "Starting user creation process..."
      if id "codigo" &>/dev/null; then
        echo "User 'codigo' already exists. Updating user configuration..."
      else
        echo "Creating user 'codigo'..."
        sudo useradd -d /home/codigo -m -s /bin/bash codigo || { echo "Failed to create user 'codigo'"; exit 1; }
      fi
      echo "Adding 'codigo' to sudo group..."
      sudo usermod -aG sudo codigo || { echo "Failed to add 'codigo' to sudo group"; exit 1; }
      echo "Setting up sudoers file for 'codigo'..."
      echo "codigo ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/codigo || { echo "Failed to set up sudoers file"; exit 1; }
      echo "Creating .ssh directory..."
      sudo mkdir -p /home/codigo/.ssh || { echo "Failed to create .ssh directory"; exit 1; }
      echo "Adding SSH public key..."
      echo "${sshPublicKey}" | sudo tee /home/codigo/.ssh/authorized_keys || { echo "Failed to add SSH public key"; exit 1; }
      echo "Setting correct ownership and permissions..."
      sudo chown -R codigo:codigo /home/codigo || { echo "Failed to set ownership of /home/codigo"; exit 1; }
      sudo chmod 700 /home/codigo/.ssh || { echo "Failed to set permissions on .ssh directory"; exit 1; }
      sudo chmod 600 /home/codigo/.ssh/authorized_keys || { echo "Failed to set permissions on authorized_keys"; exit 1; }
      echo "Creating .bashrc file..."
      sudo touch /home/codigo/.bashrc || { echo "Failed to create .bashrc file"; exit 1; }
      sudo chown codigo:codigo /home/codigo/.bashrc || { echo "Failed to set ownership of .bashrc"; exit 1; }
      sudo chmod 644 /home/codigo/.bashrc || { echo "Failed to set permissions on .bashrc"; exit 1; }
      echo "Setting up SSH config..."
      echo "StrictHostKeyChecking no" | sudo tee /home/codigo/.ssh/config || { echo "Failed to set up SSH config"; exit 1; }
      echo "User creation and setup process completed successfully."
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
      if systemctl is-active --quiet ssh; then
        sudo systemctl restart ssh
      elif systemctl is-active --quiet sshd; then
        sudo systemctl restart sshd
      else
        echo "SSH service not found. Please check the SSH service name and status."
      fi
      sudo rm -f /root/.ssh/authorized_keys
    `,
    },
    { dependsOn: [createUser], additionalSecretOutputs: ["stdout", "stderr"] },
  );

  disableRootSSH.stdout.apply((stdout) => {
    if (stdout) console.log("disableRootSSH stdout:", stdout);
  });
  disableRootSSH.stderr.apply((stderr) => {
    if (stderr) console.error("disableRootSSH stderr:", stderr);
  });

  // Install Docker
  const installDocker = new command.remote.Command(
    "installDocker",
    {
      connection: commonSshOptions.apply((options) => ({
        ...options,
        user: "codigo",
      })),
      create: `
        sudo apt-get update
        sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
        sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
        sudo usermod -aG docker codigo
        sudo systemctl enable docker
        sudo systemctl start docker
      `,
    },
    {
      dependsOn: [disableRootSSH],
      additionalSecretOutputs: ["stdout", "stderr"],
    },
  );

  installDocker.stdout.apply((stdout) => {
    if (stdout) console.log("installDocker stdout:", stdout);
  });
  installDocker.stderr.apply((stderr) => {
    if (stderr) console.error("installDocker stderr:", stderr);
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
      dependsOn: [installDocker],
      additionalSecretOutputs: ["stdout", "stderr"],
    },
  );

  installNode.stdout.apply((stdout) => {
    if (stdout) console.log("installNode stdout:", stdout);
  });
  installNode.stderr.apply((stderr) => {
    if (stderr) console.error("installNode stderr:", stderr);
  });

  return {
    installNode,
    installDocker,
    disableRootSSH,
    createUser,
    server,
  };
};
