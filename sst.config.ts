/// <reference path="./.sst/platform/config.d.ts" />

/**
 * OpenEyes infrastructure (SST v3 / Ion).
 *
 * One command (`pnpm dev` / `pnpm deploy`) provisions everything on AWS:
 *   - Media        S3 bucket for uploaded clips (browser uploads via presigned URLs)
 *   - Data         DynamoDB single-table store for events / clips / sources
 *   - Api          FastAPI on AWS Lambda (Python, via Mangum), exposed as a Function URL
 *   - Web          Next.js hub hosted on AWS (OpenNext: Lambda + CloudFront + S3)
 *
 * Secrets are NOT committed. Set the OpenAI key once per stage:
 *   pnpm sst secret set OpenAiApiKey sk-...
 */
export default $config({
  app(input) {
    return {
      name: "openeyes",
      // Dev/PR stages are fully torn down on `sst remove`; production is retained.
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
      home: "aws",
      providers: {
        aws: { region: "eu-central-1" },
      },
    };
  },

  async run() {
    // --- Secrets ------------------------------------------------------------
    const openAiApiKey = new sst.Secret("OpenAiApiKey");

    // --- Storage ------------------------------------------------------------
    // Raw uploaded media. Browsers upload directly via presigned PUT URLs that
    // the API issues, so the bucket needs permissive CORS for PUT/GET.
    const media = new sst.aws.Bucket("Media", {
      cors: {
        allowOrigins: ["*"],
        allowMethods: ["GET", "PUT", "POST", "HEAD"],
        allowHeaders: ["*"],
      },
    });

    // Single-table design:
    //   EVENT#<id>          / META                -> event
    //   EVENT#<id>          / CLIP#<id>           -> clip membership
    //   CLIP#<id>           / META                -> clip
    //   gsi1: STATUS#<s>    / OCCURRED#<ts>       -> list events by status, newest first
    const table = new sst.aws.Dynamo("Data", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
    });

    // --- Backend: FastAPI on Lambda ----------------------------------------
    const api = new sst.aws.Function("Api", {
      handler: "services/api/app/main.handler",
      runtime: "python3.12",
      url: true,
      timeout: "30 seconds",
      memory: "1024 MB",
      // `link` grants the function IAM permissions to read/write these resources.
      link: [media, table],
      environment: {
        MEDIA_BUCKET: media.name,
        DATA_TABLE: table.name,
        OPENAI_API_KEY: openAiApiKey.value,
        STAGE: $app.stage,
        // Lock this down to the Web URL for non-dev stages later.
        CORS_ORIGINS: "*",
      },
    });

    // --- Frontend: Next.js hub (hosted on AWS via OpenNext) -----------------
    const web = new sst.aws.Nextjs("Web", {
      path: "apps/web",
      environment: {
        NEXT_PUBLIC_API_URL: api.url,
      },
    });

    return {
      web: web.url,
      api: api.url,
      bucket: media.name,
      table: table.name,
    };
  },
});
