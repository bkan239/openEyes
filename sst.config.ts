/// <reference path="./.sst/platform/config.d.ts" />

/**
 * OpenEyes backend — minimal health API on AWS Lambda (no Docker).
 *
 * Deploy:  pnpm deploy
 * Smoke:   curl <api-url>/health
 */
export default $config({
  app(input) {
    return {
      name: "openeyes",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
      home: "aws",
      providers: {
        aws: { region: "us-west-1" },
      },
    };
  },

  async run() {
    const api = new sst.aws.Function("Api", {
      handler: "services/api/app/main.handler",
      runtime: "python3.12",
      url: true,
      timeout: "5 minutes",
      memory: "512 MB",
      environment: {
        STAGE: $app.stage,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
        DATA_TABLE: process.env.DATA_TABLE ?? "openeyes-dev-data",
        AWS_REGION: "us-west-1",
      },
    });

    return {
      api: api.url,
    };
  },
});
