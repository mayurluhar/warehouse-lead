# Phase 1 Prototype: Warehouse Lead Gathering & Extraction Engine (SST + AWS + React + Node/TS)

## Executive Overview
The objective of this Phase 1 prototype is to implement the core feature of the **Warehouse Lead Intelligence Platform**: **Gathering, Ingesting, and Extracting Warehouse Leads** using the production-aligned **SST v4 + AWS Serverless + Node/TypeScript + React** stack.

This architecture enables seamless local execution via `sst dev` with direct AWS Cloud integration (including Amazon Bedrock for AI extraction and S3 for raw evidence).

---

## 1. Scope of Phase 1 Prototype — Implementation Status

| Feature Area | Implementation Details | Status |
| :--- | :--- | :--- |
| **Multi-Source Ingestion** | Live Google News RSS queries, URL scraper (Cheerio), Raw newsletter text parser, Benchmark signals bank | ✅ Completed & Verified |
| **Amazon Bedrock AI Extraction** | Structured Outputs extraction with `@aws-sdk/client-bedrock-runtime` + intelligent rule NLP fallback | ✅ Completed & Verified |
| **Deterministic Scoring** | 7-Component explainable 0–100 confidence engine (Intent, Specificity, Trust, Location, Recency, Corroboration, Actionability) | ✅ Completed & Verified |
| **Deduplication & Corroboration** | SHA-256 content hashing + entity & corridor correlation with multi-source evidence merging | ✅ Completed & Verified |
| **React Intelligence Desk** | Header, Live Ingestion Control Hub, Pipeline Stats, Multi-criteria filter bar, Lead Table, and Detail Drawer with evidence quotes | ✅ Completed & Verified |

---

## 2. SST Repository Layout

```
warehouse-lead-fetcher/
├── sst.config.ts                     # SST v4 config (API Gateway, Bedrock IAM permissions, StaticSite)
├── package.json                      # Monorepo workspaces definition
├── tsconfig.json                     # Shared TypeScript configuration
├── docs/
│   └── plan/
│       ├── Warehouse_Lead_Intelligence_Platform_Neon_RnD.md  (Original Master Plan)
│       └── Phase1_Lead_Gathering_Prototype_Plan.md           (Phase 1 Technical Spec & Progress)
├── packages/
│   ├── core/                         # Domain types, normalizer, scoring, deduplication
│   ├── connectors/                   # Multi-source data adapters (Google News RSS, URL Scraper, Sample Bank)
│   └── ai/                           # Amazon Bedrock & NLP extraction engine
├── functions/                        # AWS Lambda API Handlers & Local HTTP Server
│   └── src/
│       ├── api.ts                    # Lambda API router
│       ├── store.ts                  # In-memory + S3 lead store
│       └── local-server.ts           # Standalone local dev runner
└── apps/
    └── web/                          # React + Vite Frontend
        ├── src/
        │   ├── components/
        │   │   ├── Header.tsx
        │   │   ├── StatsBar.tsx
        │   │   ├── IngestionHub.tsx
        │   │   ├── FilterBar.tsx
        │   │   ├── LeadTable.tsx
        │   │   ├── LeadDetailDrawer.tsx
        │   │   └── ScoreBreakdown.tsx
        │   ├── services/
        │   │   └── api.ts
        │   ├── types/
        │   │   └── lead.ts
        │   ├── App.tsx
        │   ├── main.tsx
        │   └── index.css
        ├── index.html
        └── vite.config.ts
```

---

## 3. How to Run

### Option A: Local Dev Mode (Zero AWS Setup Needed)
```bash
npm run dev
```
- Starts API on `http://localhost:4000`
- Starts React Frontend on `http://localhost:5173`

### Option B: SST Dev Mode (Connected to AWS Cloud & Amazon Bedrock)
```bash
npm run dev:sst
# or
npx sst dev
```
Deploy the SST infrastructure and run live Lambda development directly attached to Amazon Bedrock and AWS S3.
