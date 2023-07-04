import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
// import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

const DOMAIN_NAME = "getdextop.com";
// const ASSETS_PATH = "../website/dist";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, `${DOMAIN_NAME}-s3-bucket`, {
      bucketName: DOMAIN_NAME,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const certificate = new acm.Certificate(
      this,
      `${DOMAIN_NAME}-acm-certificate`,
      {
        domainName: DOMAIN_NAME,
        validation: acm.CertificateValidation.fromDns(),
      }
    );

    const cloudfrontFunction = new cloudfront.Function(
      this,
      `${DOMAIN_NAME}-cloudfront-function`,
      {
        code: cloudfront.FunctionCode.fromInline(
          `function handler(event) {
            var request = event.request;
            var uri = request.uri;

            if (uri.endsWith('/')) {
                request.uri += 'index.html';
            } else if (!uri.includes('.')) {
                request.uri += '/index.html';
            }

            return request;
          }`
        ),
      }
    );

    const distribution = new cloudfront.Distribution(
      this,
      `${DOMAIN_NAME}-cloudfront-distribution`,
      {
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        certificate,
        domainNames: [DOMAIN_NAME],
        defaultBehavior: {
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          origin: new origins.S3Origin(bucket),
          functionAssociations: [
            {
              function: cloudfrontFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      }
    );

    // new s3deploy.BucketDeployment(this, `${DOMAIN_NAME}-s3-deploy`, {
    //   sources: [s3deploy.Source.asset(ASSETS_PATH)],
    //   destinationBucket: bucket,
    //   distribution,
    // });

    new cdk.CfnOutput(this, "cloudfront-distribution-domain", {
      value: distribution.distributionId,
    });
  }
}
