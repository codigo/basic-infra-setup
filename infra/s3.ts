import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export function createS3Bucket() {

  const appBucket = new aws.s3.Bucket('Backups Bucket', {
    bucket: `codigo-backups`,
    acl: "private",
    forceDestroy: true,
  });

  return { appBucket: pulumi.output(appBucket) };
}
