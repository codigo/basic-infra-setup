import * as hcloud from "@pulumi/hcloud";
import * as pulumi from "@pulumi/pulumi";

export function createHetznerServer() {
  const config = new pulumi.Config();
  const appName = config.require("appName");

  const sshKey = new hcloud.SshKey("deploy-key", {
    name: `${appName}-deploy-key`,
    publicKey: config.require("sshPublicKey"),
  });

  const server = new hcloud.Server(`${appName}-server`, {
    name: `${appName}-server`,
    serverType: "cx11",
    image: "ubuntu-24.04",
    sshKeys: [sshKey.id],
  });

  return { server: pulumi.output(server as hcloud.Server), publicIp: server.ipv4Address };
}
