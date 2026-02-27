import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export const createS3Bucket = () => {
  const appBucket = new aws.s3.Bucket("Backups Bucket", {
    bucket: `codigo-backups`,
    acl: "private",
    forceDestroy: true,
    lifecycleRules: [
      {
        enabled: true,
        prefix: "backups/",
        expiration: {
          days: 90,
        },
      },
    ],
  });

  return {
    appBucket,
    bucketUrl: pulumi.interpolate`https://${appBucket.bucket}.s3.amazonaws.com`,
  };
};
