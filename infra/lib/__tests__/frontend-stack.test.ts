import { describe, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { DataStack } from "../data-stack";
import { FrontendStack } from "../frontend-stack";

function template() {
  const app = new App();
  const data = new DataStack(app, "Data");
  const frontend = new FrontendStack(app, "Frontend", {
    snapshotBucket: data.snapshotBucket,
  });
  return Template.fromStack(frontend);
}

describe("FrontendStack", () => {
  it("creates exactly 1 CloudFront Distribution", () => {
    template().resourceCountIs("AWS::CloudFront::Distribution", 1);
  });

  it("creates at least 1 S3 Bucket (site bucket)", () => {
    const t = template();
    // The FrontendStack creates a site bucket (BLOCK_ALL, RETAIN)
    t.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("creates a Custom::CDKBucketDeployment resource", () => {
    template().resourceCountIs("Custom::CDKBucketDeployment", 1);
  });

  it("distribution has a CacheBehavior with PathPattern snapshot.json", () => {
    template().hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: "snapshot.json",
          }),
        ]),
      }),
    });
  });

  it("uses the cheapest CloudFront price class (PriceClass_100)", () => {
    template().hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({ PriceClass: "PriceClass_100" }),
    });
  });
});
