import * as pulumi from "@pulumi/pulumi";

export interface ServerResources {
  server: any;
  sshKey: any;
  privateNetwork: any;
  privateSubnet: any;
  privateIp: string;
}

export interface ServerProvider {
  createServer(
    appName: string,
    publicKey: pulumi.Output<string>,
  ): pulumi.Output<ServerResources>;
}
