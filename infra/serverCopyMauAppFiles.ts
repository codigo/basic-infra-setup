import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const copyMauAppDataFilesToServer = (server: Server) => {
  // Define the server details and credentials
  const config = new pulumi.Config();
  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");
  const docker_compose_mau_app = config.require("docker_compose_mau_app");
  const pocketbaseEntrypoint = config.require("pocketbaseEntrypoint");
  const typesenseEntrypoint = config.require("typesenseEntrypoint");

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  const commonSshOptions = pulumi
    .all([server.ipv4Address, sshPrivateKey])
    .apply(([ip, key]) => ({
      host: ip,
      user: "codigo", // Corrected property
      privateKey: key,
    }));

  // SCP commands to copy docker compose app string to the server
  const createMauAppFolders = new command.remote.Command(
    "create mau app data folders",
    {
      connection: commonSshOptions,
      create: pulumi.interpolate`
      mkdir -p /home/codigo/mau-app/bin/pocketbase &&
      mkdir -p /home/codigo/mau-app/bin/typesense &&
      mkdir -p /home/codigo/mau-app/data/pocketbase/pb_data &&
      mkdir -p /home/codigo/mau-app/data/pocketbase/pb_public &&
      mkdir -p /home/codigo/mau-app/data/pocketbase/pb_migrations &&
      mkdir -p /home/codigo/mau-app/data/typesense
      `,
    },
  );

  const scpEntryPointPocketbase = new command.remote.Command(
    "scp entrypoint.sh pocketbase",
    {
      connection: commonSshOptions,
      create: pulumi.interpolate`echo '${pocketbaseEntrypoint}' > /home/codigo/mau-app/bin/pocketbase/entrypoint.sh && chmod +x /home/codigo/mau-app/bin/pocketbase/entrypoint.sh`,
    },
    { dependsOn: createMauAppFolders },
  );

  const scpEntryPointTypesense = new command.remote.Command(
    "scp entrypoint.sh typesense",
    {
      connection: commonSshOptions,
      create: pulumi.interpolate`echo '${typesenseEntrypoint}' > /home/codigo/mau-app/bin/typesense/entrypoint.sh && chmod +x /home/codigo/mau-app/bin/typesense/entrypoint.sh`,
    },
    { dependsOn: createMauAppFolders },
  );

  // SCP commands to copy docker compose tooling string to the server
  const scpDockerComposeMauApp = new command.remote.Command(
    "scp docker compose mau app ",
    {
      connection: commonSshOptions,
      create: pulumi.interpolate`cat << EOF > /home/codigo/docker-compose.mau-app.yaml
${docker_compose_mau_app}
EOF
`,
    },
    { dependsOn: [scpEntryPointPocketbase, scpEntryPointTypesense, createMauAppFolders] },
  );

  return {
    createMauAppFolders,
    scpDockerComposeMauApp,
    scpEntryPointPocketbase,
    scpEntryPointTypesense,
  };
};
