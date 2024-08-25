import * as hcloud from "@pulumi/hcloud";
import * as pulumi from "@pulumi/pulumi";

export function createHetznerServer() {
  const config = new pulumi.Config();
  const appName = config.require("appName");

  // Get the base64-encoded public key from the configuration
  let encodedPublicKey = config.requireSecret("sshPublicKey");

  // Decode the base64-encoded public key and ensure the key type is specified
  const publicKey = encodedPublicKey.apply((encodedKey) => {
    let decodedKey = Buffer.from(encodedKey, "base64").toString("utf-8").trim();

    if (
      !decodedKey.startsWith("ssh-rsa") &&
      !decodedKey.startsWith("ssh-ed25519") &&
      !decodedKey.startsWith("ecdsa-sha2-nistp")
    ) {
      throw new Error(
        "Invalid SSH key format. The key should start with ssh-rsa, ssh-ed25519, or ecdsa-sha2-nistp.",
      );
    }

    return decodedKey;
  });
  // Ensure the key type is specified
  if (
    !publicKey.apply((key) => key.startsWith("ssh-rsa")) &&
    !publicKey.apply((key) => key.startsWith("ssh-ed25519")) &&
    !publicKey.apply((key) => key.startsWith("ecdsa-sha2-nistp"))
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
    location: "hil",
  });

  return {
    server: pulumi.output(server as hcloud.Server),
    publicIp: server.ipv4Address,
  };
}
