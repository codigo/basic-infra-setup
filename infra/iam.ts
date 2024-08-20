import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function createIAMResources() {
  const config = new pulumi.Config();
  const appName = config.require("appName");

  const iamUser = new aws.iam.User(`${appName}-user`, {
    name: `${appName}-user`,
    path: "/system/",
  });

  const accessKey = new aws.iam.AccessKey(`${appName}-access-key`, {
    user: iamUser.name,
  });

  const policy = new aws.iam.UserPolicy(`${appName}-user-policy`, {
    user: iamUser.name,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ],
        Resource: [
          pulumi.interpolate`arn:aws:s3:::${appName}-bucket/*`,
          pulumi.interpolate`arn:aws:s3:::tooling-bucket/*`
        ]
      }]
    }),
  });

  return { iamUser, accessKey };
}
