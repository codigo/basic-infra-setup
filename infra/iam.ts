import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export const createIAMResources = () => {
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
          `arn:aws:s3:::${appName}-bucket`,
          `arn:aws:s3:::${appName}-bucket/*`,
          "arn:aws:s3:::tooling-bucket",
          "arn:aws:s3:::tooling-bucket/*",
        ],
      },
    ],
  };

  // Create an IAM policy
  const policy = new aws.iam.Policy(`${appName}-user-policy`, {
    description: `A policy for ${appName}-user`,
    policy: JSON.stringify(policyDocument),
  });

  // Attach the policy to the IAM user
  const userPolicy = new aws.iam.UserPolicyAttachment(
    `${appName}-user-policy-attach`,
    {
      user: iamUser.name,
      policyArn: policy.arn,
    },
    { dependsOn: [iamUser, policy] },
  );

  return {
    iamUser,
    accessKey,
    policy,
    userPolicy,
  };
};
