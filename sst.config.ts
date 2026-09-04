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
      // A targeted scan fans out across ~36 Google News queries plus 12
      // publication feeds, then runs each surviving document through Bedrock
      // sequentially (deduplication depends on ordering). The connectors hold
      // their own fetch budgets, but extraction dominates and 60s was no longer
      // enough once the feed list grew.
      timeout: "300 seconds",
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
        // No default: the region must match where model access was granted,
        // and guessing one produces throttling that looks like a quota problem.
        BEDROCK_REGION: process.env.BEDROCK_REGION || "ap-south-1",
        // A bare foundation-model ID is fine: the extractor retries with the
        // region's inference-profile ID (us./eu./apac.) when Bedrock reports
        // that on-demand throughput is unsupported. See .env.example.
        DEFAULT_MODEL_ID: process.env.DEFAULT_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0",

        // Document sources and geocoding are configuration, not code — no feed
        // URL, place name or coordinate is held in the repository. See
        // .env.example for the formats and a working starter feed list.
        PUBLICATION_FEEDS: process.env.PUBLICATION_FEEDS || "",
        ENABLE_GOOGLE_NEWS: process.env.ENABLE_GOOGLE_NEWS || "",
        NOMINATIM_BASE_URL: process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org",
        NOMINATIM_USER_AGENT:
          process.env.NOMINATIM_USER_AGENT || "warehouse-lead-intelligence-poc/0.1",
        NOMINATIM_MIN_INTERVAL_MS: process.env.NOMINATIM_MIN_INTERVAL_MS || "1100",
        NOMINATIM_PROBE_COUNT: process.env.NOMINATIM_PROBE_COUNT || "4",
        NOMINATIM_COUNTRY_CODE: process.env.NOMINATIM_COUNTRY_CODE || "",

        // LinkedIn discovery reaches only publicly indexed pages, through a
        // search provider. Unset leaves the tab disabled rather than broken.
        SEARCH_PROVIDER: process.env.SEARCH_PROVIDER || "",
        SEARCH_API_KEY: process.env.SEARCH_API_KEY || "",
        LINKEDIN_MAX_QUERIES: process.env.LINKEDIN_MAX_QUERIES || "8",
        LINKEDIN_RESULTS_PER_QUERY: process.env.LINKEDIN_RESULTS_PER_QUERY || "10",
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
