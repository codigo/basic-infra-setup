import * as hcloud from "@pulumi/hcloud";
import * as pulumi from "@pulumi/pulumi";

export function createHetznerServer() {
  const config = new pulumi.Config();
  const appName = config.require("appName");

  // Get the base64-encoded public key from the configuration
  let encodedPublicKey = config.require("sshPublicKey");

  // Decode the base64-encoded public key
  let publicKey = Buffer.from(encodedPublicKey, "base64").toString("utf-8");

  // Trim any leading or trailing whitespace
  publicKey = publicKey.trim();

  // Ensure the key type is specified
  if (
    !publicKey.startsWith("ssh-rsa") &&
    !publicKey.startsWith("ssh-ed25519") &&
    !publicKey.startsWith("ecdsa-sha2-nistp")
  ) {
    throw new Error(
      "Invalid SSH key format. The key should start with ssh-rsa, ssh-ed25519, or ecdsa-sha2-nistp.",
    );
  }

  const sshKey = new hcloud.SshKey("deploy-key", {
    name: `${appName}-deploy-key`,
    publicKey: publicKey,
  });

  const server = new hcloud.Server(`${appName}-server`, {
    name: `${appName}-server`,
    serverType: "cpx11",
    image: "ubuntu-24.04",
    sshKeys: [sshKey.id],
    location: "hil"
  });

  return {
    server: pulumi.output(server as hcloud.Server),
    publicIp: server.ipv4Address,
  };
}
