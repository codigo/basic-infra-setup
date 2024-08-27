import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

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
