// infra/hetznerProvider.ts
import * as hcloud from "@pulumi/hcloud";
import * as pulumi from "@pulumi/pulumi";
import { ServerProvider, ServerResources } from "./serverProvider";

const PRIVATE_NETWORK_RANGE = "10.42.0.0/16";
const PRIVATE_SUBNET_RANGE = "10.42.1.0/24";
const TOOLING_PRIVATE_IP = "10.42.1.2";
const HETZNER_LOCATION = "hil";
const HETZNER_NETWORK_ZONE = "us-west";

export class HetznerProvider implements ServerProvider {
  createServer(
    appName: string,
    publicKey: pulumi.Output<string>,
  ): pulumi.Output<ServerResources> {
    const sshKey = new hcloud.SshKey(
      "deploy-key",
      {
        name: `${appName}-deploy-key`,
        publicKey: publicKey,
      },
      { ignoreChanges: ["publicKey"] },
    );

    const privateNetwork = new hcloud.Network(`${appName}-private-network`, {
      name: `${appName}-private-network`,
      ipRange: PRIVATE_NETWORK_RANGE,
    });

    const privateSubnet = new hcloud.NetworkSubnet(
      `${appName}-private-subnet`,
      {
        networkId: privateNetwork.id.apply(Number),
        type: "cloud",
        networkZone: HETZNER_NETWORK_ZONE,
        ipRange: PRIVATE_SUBNET_RANGE,
      },
    );

    const server = new hcloud.Server(
      `${appName}-server`,
      {
        name: `${appName}-server`,
        serverType: "cpx11",
        image: "ubuntu-24.04",
        sshKeys: [sshKey.id],
        location: HETZNER_LOCATION,
        networks: [
          {
            networkId: privateNetwork.id.apply(Number),
            ip: TOOLING_PRIVATE_IP,
          },
        ],
      },
      { dependsOn: [sshKey, privateSubnet] },
    );

    return pulumi.output({
      server,
      sshKey,
      privateNetwork,
      privateSubnet,
      privateIp: pulumi.output(TOOLING_PRIVATE_IP),
    });
  }
}
