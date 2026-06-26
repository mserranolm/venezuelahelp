import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface CicdStackProps extends StackProps {
  githubRepo: string; // e.g. "Venezuelahelp/venezuelahelp"
}

function managed(name: string) {
  return iam.ManagedPolicy.fromAwsManagedPolicyName(name);
}

export class CicdStack extends Stack {
  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, "GithubOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const role = new iam.Role(this, "DeployRole", {
      assumedBy: new iam.WebIdentityPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            // Only workflows running on the main branch can assume this role.
            // workflow_dispatch (rollback) also runs on main, so this covers both.
            "token.actions.githubusercontent.com:sub": `repo:${props.githubRepo}:ref:refs/heads/main`,
          },
        },
      ),
      // Scoped to the exact AWS services this project uses.
      // IAMFullAccess is required because CDK creates execution roles for Lambda,
      // grants for CloudFront OAC, and the OIDC provider itself.
      managedPolicies: [
        managed("AWSCloudFormationFullAccess"),
        managed("AmazonS3FullAccess"),
        managed("AWSLambda_FullAccess"),
        managed("IAMFullAccess"),
        managed("CloudFrontFullAccess"),
        managed("AmazonRoute53FullAccess"),
        managed("AWSCertificateManagerFullAccess"),
        managed("AmazonDynamoDBFullAccess"),
        managed("AmazonSQSFullAccess"),
        managed("AmazonAPIGatewayAdministrator"),
        managed("AmazonEventBridgeFullAccess"),
        managed("AWSBudgetsFullAccess"),
        managed("AmazonSSMFullAccess"),
        managed("CloudWatchLogsFullAccess"),
      ],
    });

    // Cognito: no AWS-managed full-access policy exists; inline covers CRUD.
    // STS: CDK CLI calls GetCallerIdentity before synthesising.
    // EC2 Describe: CDK uses this for context lookups (AZs, VPCs).
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:*", "sts:GetCallerIdentity", "ec2:Describe*"],
        resources: ["*"],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: role.roleArn });
  }
}
