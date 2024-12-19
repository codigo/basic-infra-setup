# Understanding the Mau App Infrastructure Project: Part 3 - Cloud Provider Setup

In this part, we'll explore how we set up and configure our cloud providers using Pulumi. Our project utilizes two main cloud providers: AWS for storage and Hetzner Cloud for compute resources. We'll dive into how we configure each provider and the resources we create.

## AWS Setup

We use AWS primarily for S3 storage. Here's how we set it up:

1. **S3 Bucket Creation**: We create an S3 bucket for storing backups. This is defined in `infra/s3.ts`:

   ```typescript
   export const createS3Bucket = () => {
     const appBucket = new aws.s3.Bucket("Backups Bucket", {
       bucket: `codigo-backups`,
       acl: "private",
       forceDestroy: true,
     });

     return {
       appBucket,
       bucketUrl: pulumi.interpolate`https://${appBucket.bucket}.s3.amazonaws.com`,
     };
   };
   ```

   This function creates a private S3 bucket named "codigo-backups" and returns the bucket object and its URL.

2. **IAM Resources**: We also set up IAM resources to manage access to our AWS services. This is defined in `infra/iam.ts`:

   ```typescript
   export const createIAMResources = () => {
     const iamUser = new aws.iam.User(`${appName}-user`, {
       name: `${appName}-user`,
       path: "/system/",
     });

     const accessKey = new aws.iam.AccessKey(`${appName}-access-key`, {
       user: iamUser.name,
     });

     // ... policy creation and attachment
   };
   ```

   This function creates an IAM user, access key, and attaches a policy that allows specific S3 actions.

## Hetzner Cloud Setup

We use Hetzner Cloud for our compute resources. The setup is defined in `infra/hetznerProvider.ts`:

```typescript
export class HetznerProvider implements ServerProvider {
  createServer(
    appName: string,
    publicKey: pulumi.Output<string>,
  ): pulumi.Output<any> {
    const sshKey = new hcloud.SshKey("deploy-key", {
      name: `${appName}-deploy-key`,
      publicKey: publicKey,
    });

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
```

This class implements the `ServerProvider` interface and creates a Hetzner Cloud server with the specified configuration.

## Provider Abstraction

One interesting aspect of our setup is the use of a provider abstraction. We define a `ServerProvider` interface in `infra/serverProvider.ts`:

```typescript
export interface ServerProvider {
  createServer(
    appName: string,
    publicKey: pulumi.Output<string>,
  ): pulumi.Output<any>;
}
```

This abstraction allows us to easily switch between different cloud providers for our compute resources without changing the rest of our infrastructure code.

## Configuration Management

We use Pulumi's configuration system to manage sensitive information:

```typescript
const config = new pulumi.Config();
const awsAccessKeyId = config.requireSecret("awsAccessKeyId");
const awsSecretAccessKey = config.requireSecret("awsSecretAccessKey");
```

These values are stored securely and can be set using the Pulumi CLI or environment variables.

## Next Steps

In the next part, we'll explore how we set up Docker and Docker Swarm on our Hetzner Cloud server. We'll look at how we configure the server, install necessary software, and prepare it for running our containerized applications.

Understanding how to set up and configure cloud providers is crucial for any modern web application. By using Pulumi, we can manage these resources programmatically, ensuring consistency and making it easier to replicate our infrastructure.
