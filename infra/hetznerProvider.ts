// infra/hetznerProvider.ts
import * as hcloud from "@pulumi/hcloud";
import * as pulumi from "@pulumi/pulumi";
import { ServerProvider } from "./serverProvider";

export class HetznerProvider implements ServerProvider {
  createServer(
    appName: string,
    publicKey: pulumi.Output<string>,
  ): pulumi.Output<any> {
    const sshKey = new hcloud.SshKey(
      "deploy-key",
      {
        name: `${appName}-deploy-key`,
        publicKey: publicKey,
      },
      { ignoreChanges: ["publicKey"] },
    );

    const server = new hcloud.Server(
      `${appName}-server`,
      {
        name: `${appName}-server`,
        serverType: "cpx11",
        image: "ubuntu-24.04",
        sshKeys: [sshKey.id],
        location: "hil",
      },
      { dependsOn: sshKey },
    );

    return pulumi.output({ server, sshKey });
  }
}
