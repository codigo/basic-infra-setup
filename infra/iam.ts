import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function createIAMResources() {
  const config = new pulumi.Config();
  const appName = config.require("appName");
  // Create an IAM user
  const iamUser = new aws.iam.User(`${appName}-user`, {
    name: `${appName}-user`,
    path: "/system/",
  });

  // Create an access key for the IAM user
  const accessKey = new aws.iam.AccessKey(`${appName}-access-key`, {
    user: iamUser.name,
  });

  // Define the policy document
  const policyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject",
        ],
        Resource: [
          pulumi.interpolate`arn:aws:s3:::${appName}-bucket/*`,
          pulumi.interpolate`arn:aws:s3:::tooling-bucket/*`,
        ],
      },
    ],
  };

  // Attach the policy to the IAM user
  const userPolicy = new aws.iam.UserPolicy(`${appName}-user-policy`, {
    user: iamUser.name,
    policy: JSON.stringify(policyDocument),
  });

  return { iamUser, accessKey };
}
