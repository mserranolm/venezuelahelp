import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";

export class DataStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly snapshotBucket: s3.Bucket;
  public readonly scraperDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, "Table", {
      tableName: "VenezuelaHelp",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.snapshotBucket = new s3.Bucket(this, "SnapshotBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Grant CloudFront OAC read access to snapshot.json.
    // Uses an account-scoped wildcard distribution ARN to avoid referencing
    // FrontendStack's distribution (which would create a cross-stack cycle).
    this.snapshotBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontReadSnapshot",
        actions: ["s3:GetObject"],
        resources: [this.snapshotBucket.arnForObjects("snapshot.json")],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/*`,
          },
        },
      }),
    );

    this.scraperDlq = new sqs.Queue(this, "ScraperDlq", {
      queueName: "venezuelahelp-scraper-dlq",
      retentionPeriod: Duration.days(14),
    });
    this.scraperDlq.applyRemovalPolicy(RemovalPolicy.RETAIN);

    new ssm.StringParameter(this, "TableNameParam", {
      parameterName: "/venezuelahelp/table-name",
      stringValue: this.table.tableName,
    });
  }
}
