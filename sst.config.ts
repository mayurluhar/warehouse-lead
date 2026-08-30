/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "warehouse-lead-platform",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    // S3 Bucket for raw evidence & ingested documents
    const evidenceBucket = new sst.aws.Bucket("evidencebucketwarehouse");

    // API Lambda Function supporting AWS Bedrock & S3
    const api = new sst.aws.Function("ApiHandler", {
      handler: "functions/src/api.handler",
      // CORS is owned by the handler (functions/src/api.ts CORS_HEADERS), which is
      // the only source that works across all three runtimes: Lambda Function URL,
      // `sst dev`, and the plain node local-server.
      //
      // Do NOT set `url: true` here. SST expands that to a default Function URL CORS
      // config of allowOrigins/allowMethods/allowHeaders ["*"], and AWS then injects
      // its own Access-Control-Allow-Origin alongside the handler's. The browser sees
      // two values ("*, *") and blocks every response.
      url: { cors: false },
      link: [evidenceBucket],
      timeout: "60 seconds",
      memory: "1024 MB",
      permissions: [
        {
          actions: [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
            "bedrock:Converse",
            "bedrock:ConverseStream",
            "bedrock:ListFoundationModels"
          ],
          resources: ["*"],
        },
      ],
      environment: {
        BEDROCK_REGION: process.env.BEDROCK_REGION || "us-east-1",
        DEFAULT_MODEL_ID: process.env.DEFAULT_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0",
      },
    });

    // React Frontend (Vite)
    const web = new sst.aws.StaticSite("Web", {
      path: "apps/web",
      build: {
        command: "npm run build",
        output: "dist",
      },
      environment: {
        VITE_API_URL: api.url,
      },
    });

    return {
      apiUrl: api.url,
      webUrl: web.url,
      evidenceBucket: evidenceBucket.name,
    };
  },
});
