# Warehouse Lead Intelligence Platform

> Source: Converted from the supplied Product & Technical Requirements
> DOCX. Purpose: Model-readable requirements specification. Database
> decision: Neon Postgres for R&D/MVP, while retaining the AWS/SST
> serverless architecture.

Lead Intelligence

Warehouse Requirement Discovery Platform

Product Requirements • AWS/SST Architecture • Data Ingestion • AI
Extraction • Lead Matching • Delivery Roadmap

  -----------------------------------------------------------------------
  Objective Build an early-warning platform for warehouse
  owners/developers that continuously discovers public signals indicating
  that a company, government body, 3PL, manufacturer, retailer, or other
  occupier may need warehouse space or logistics land, converts those
  signals into structured leads, and matches them against the client's
  warehouse inventory.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

Prepared from: the supplied "Lead Intelligence Desk --- Demo" HTML
prototype, expanded into a production-ready AWS-first design.

Recommended implementation: TypeScript/Node.js + SST v4 + AWS serverless
services, with Amazon Bedrock used for structured extraction and lead
reasoning.

# 1. Executive summary

The platform should not be thought of as a generic news reader. Its
value is the conversion of noisy public information into qualified,
traceable, actionable warehouse leads. A useful lead must answer: who
may need space, where, approximately how much, for what use, how certain
the signal is, where the evidence came from, and which client warehouse
is most suitable.

  -----------------------------------------------------------------------
  Recommended MVP Start with Gujarat/selected corridors, public tenders +
  business news + newsletters, one client organization, 5-15 warehouse
  properties, deterministic + AI lead scoring, human review, email
  digest, and basic lead-to-warehouse matching. Avoid broad social
  scraping and expensive search infrastructure in the first release.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## Core business outcome

Discover requirements earlier than manual sales teams can.

Reduce time spent searching multiple tender portals, publications,
newsletters and company announcements.

Create one deduplicated lead even when the same requirement appears in
several sources.

Prioritize leads using explainable confidence and warehouse-fit scores.

Preserve the exact evidence/source so every lead can be verified before
outreach.

Track lead progression from Inbox → Approved → Contacted → Won/Lost and
attribute deal value to the platform.

## Key recommendation

Use AI for extraction, classification and reasoning, but do not let the
LLM be the only source of truth for confidence. The final score should
combine deterministic business rules (source quality, explicit
requirement size, location match, recency, tender status, corroboration)
with model-extracted facts.

# 2. Product scope and user roles

## Primary user

A warehouse owner, developer, leasing/sales team or logistics
real-estate operator that owns or manages warehouse properties and wants
to identify new occupier demand.

## Suggested roles

  -----------------------------------------------------------------------
  Role                                Capabilities
  ----------------------------------- -----------------------------------
  Admin                               Manage organization, users,
                                      warehouse inventory, source
                                      connectors, keywords, scoring
                                      rules, notification settings.

  Analyst / Reviewer                  Review signals, verify evidence,
                                      edit extracted fields,
                                      approve/reject leads, add notes,
                                      assign leads.

  Sales / Leasing                     See approved/matched leads, contact
                                      prospects, record activity and deal
                                      outcome.

  Read-only / Management              View dashboard, pipeline, coverage,
                                      conversion and won value without
                                      changing records.
  -----------------------------------------------------------------------

## Out of scope for the first MVP

Automated cold outreach or bulk LinkedIn messaging.

A full CRM replacement.

Real-time crawling of the entire public web.

Automatic legal interpretation of tender eligibility.

Guaranteed identification of a named decision-maker when the public
source does not contain one.

Custom foundation-model training.

# 3. What the supplied demo already defines

The prototype is a strong product-direction reference. The production
build should preserve these concepts while replacing seed/local-storage
data with persistent multi-user services.

  -----------------------------------------------------------------------
  Demo capability                     Production interpretation
  ----------------------------------- -----------------------------------
  Lead inbox with new/aging signals   Persistent lead queue, freshness
                                      SLA, unread state per
                                      user/organization.

  Intent badges: Active RFP,          Normalized intent enum generated
  Scouting, Tender, Expansion,        during extraction and editable by
  Rumoured                            reviewers.

  Company, requirement size,          Structured lead fields with units,
  corridor, industry                  normalized locations and source
                                      provenance.

  Confidence percentage + reasons     Explainable composite score with
                                      stored score components and model
                                      evidence.

  Corroborating sources               Duplicate/correlation engine that
                                      groups articles/tenders referring
                                      to the same underlying requirement.

  Exact article / source snippet      Evidence record retaining canonical
                                      URL, title, source, timestamp,
                                      excerpt and raw-document reference.

  Approve / reject / contacted        Lead workflow state machine with
                                      audit history and optional
                                      assignee.

  Review notes                        Team notes/activity records in the
                                      database.

  Won / lost + deal value             Outcome tracking and attribution
                                      dashboard.

  Excel / email list                  Server-generated CSV/XLSX export
                                      and email digest/report.
  -----------------------------------------------------------------------

# 4. Functional requirements

## 4.1 Source monitoring & ingestion

Create a configurable source registry: source name, source type, URL/API
endpoint, language, geography, trust tier, fetch frequency, access
method and enabled/disabled state.

Support scheduled collection using APIs/RSS first; only use HTML
retrieval where permitted and technically reliable.

Support inbound newsletter email ingestion so trade newsletters can be
forwarded/subscribed directly into the platform.

Store the raw response/document in S3 before AI processing for
traceability and reprocessing.

Track fetch status, HTTP/result code, last successful scan, last item
timestamp, item count and errors.

Support PDF/tender-document ingestion; use text extraction for digital
PDFs and OCR only when the document is scanned.

Add language detection and optional Gujarati/Hindi → English translation
before extraction.

## 4.2 Article/document normalization

Canonicalize URL and strip tracking parameters where possible.

Extract title, publication, author (when available), published
timestamp, text/body, source language and document type.

Generate a stable raw-content hash to prevent reprocessing identical
content.

Preserve original text and extraction version.

## 4.3 AI relevance classification

Classify whether the content contains a real warehouse/logistics-land
requirement signal or is only general market commentary.

Classify signal intent: tender, active RFP, scouting, expansion, land
requirement, lease/hiring, construction/build-to-suit, rumour/watch.

Reject obvious false positives such as articles merely describing
existing warehouses, market reports without an occupier requirement, or
unrelated storage products.

## 4.4 Structured requirement extraction

Extract company/organization, industry, requirement type, requested
area/acreage, unit, preferred city/corridor/industrial estate,
deadline/timeline, special facility requirements, lease term when
stated, named contact, tender reference and source quote/evidence.

Use Amazon Bedrock Structured Outputs with a strict JSON Schema so
downstream services receive predictable JSON.

Store null/unknown explicitly instead of inventing missing values.

Store a model-generated explanation and evidence offsets/snippets
separately from the normalized fields.

## 4.5 Duplicate detection & corroboration

Exact duplicate: canonical URL/content hash.

Near duplicate: normalized title + organization + location + requirement
size + time window.

Correlated signal: different publication/source describing the same
underlying requirement.

Create one lead with multiple evidence/source records rather than
duplicate lead cards.

Recalculate confidence when additional independent evidence appears.

## 4.6 Lead scoring

Compute an explainable 0--100 confidence score from deterministic
components plus optional AI assessment.

Store score components so users can see why a lead is high/medium/low
confidence.

Allow organization-level scoring weights to be changed without
redeploying code.

## 4.7 Warehouse inventory & lead matching

Maintain the client's warehouse portfolio and currently available
capacity.

Match each lead to one or more properties using location, available
size, facility type/capabilities and timing.

Show a separate warehouse-fit score; do not confuse it with source
confidence.

Allow analysts to override/reject a suggested match and record the
reason.

## 4.8 Review and sales workflow

Inbox, Approved, Contacted, Rejected and optionally Qualified states.

Assign lead to a user; record notes, activities, last contact date and
next action.

Allow extracted fields to be corrected by a human while retaining
original AI values for audit.

Record Won/Lost outcome and optional deal value, warehouse selected and
reason lost.

## 4.9 Search, filters and dashboards

Search company, industry, location/corridor, tender reference and source
text.

Filter by date, source type, intent, confidence, warehouse-fit, area,
industry, state/corridor, status and assignee.

Dashboard: new signals, awaiting review, approved, contacted, won value,
source performance, false-positive rate, average time-to-review and lead
conversion.

## 4.10 Notifications & exports

Immediate alert for very high-confidence/high-fit signals.

Daily digest for normal signals; weekly management summary optional.

Email via SES; optional Slack/Teams integration later.

CSV/XLSX export with exact source links and selected filters.

# 5. Data-source strategy

Source coverage will determine product value more than the UI. Build
connectors as isolated adapters so a source can be changed or disabled
without touching the intelligence pipeline.

  ---------------------------------------------------------------------------------
  Source group      Examples / use        Preferred acquisition   MVP?
  ----------------- --------------------- ----------------------- -----------------
  Government        CPPP/eProcure;        Public portal/API/feed  Yes
  procurement       warehouse/godown      when available;         
                    hiring, EOI,          permitted page/document 
                    logistics parks,      retrieval; store tender 
                    storage construction  PDF                     

  Gujarat/state     State/local-body      Source-specific         Yes
  tender portals    warehousing,          adapter; verify terms,  
                    GIDC/APMC/PSU         captcha and             
                    requirements          automated-access        
                                          limitations             

  Business news     Expansion/scouting    News API, publication   Yes
                    announcements by 3PL, RSS/API, licensed       
                    e-commerce, pharma,   aggregation             
                    auto, FMCG                                    

  Global/public     Broader discovery and GDELT as                Optional
  news index        multilingual coverage discovery/secondary     
                                          source                  

  Company press     New plant,            Company newsroom        Yes
  releases          fulfillment centre,   RSS/sitemap/allowed     
                    distribution          fetch                   
                    expansion                                     

  Trade newsletters Land/warehouse        Inbound SES email → S3  Yes
                    requirements that may → parser                
                    not have a public URL                         

  Social signals    Executive/company     Official/licensed API   Later
                    posts indicating      or analyst-submitted    
                    scouting or expansion URL; avoid unrestricted 
                                          scraping                

  Tender            Cross-portal          Licensed                Later
  aggregators       discovery             API/feed/subscription   
                                          where available; always 
                                          retain underlying       
                                          tender                  

  Manual analyst    Phone/email/offline   Create lead form +      Yes
  entry             intelligence          evidence upload/link    
  ---------------------------------------------------------------------------------

  -----------------------------------------------------------------------
  Important source rule Never treat a search result, aggregator headline,
  or AI summary as the final evidence. The lead should retain the best
  available original publication/tender URL and, where legally permitted,
  the source text/document used for extraction.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## Recommended initial query vocabulary

  -----------------------------------------------------------------------
  Category                            Example terms
  ----------------------------------- -----------------------------------
  Requirement                         "warehouse required", "warehouse on
                                      lease", "godown required", "hiring
                                      of godown", "covered storage",
                                      "storage space required"

  Expansion/scouting                  "scouting warehouse", "looking for
                                      warehouse", "distribution centre
                                      expansion", "fulfilment centre",
                                      "logistics facility", "new DC"

  Tender/EOI                          "warehouse tender", "godown
                                      tender", "EOI warehouse", "lease of
                                      warehouse", "hiring warehouse",
                                      "construction-cum-lease"

  Land/BTS                            "logistics land", "built-to-suit
                                      warehouse", "industrial land
                                      logistics", "logistics park plot",
                                      "distribution hub land"

  Specialized                         "cold storage", "bonded warehouse",
                                      "hazardous storage", "GMP
                                      warehouse", "SEZ storage"
  -----------------------------------------------------------------------

# 6. Confidence and fit scoring

## 6.1 Lead confidence score (0--100)

Suggested starting weights; make them configurable:

  --------------------------------------------------------------------------
  Component               Weight                  Example
  ----------------------- ----------------------- --------------------------
  Intent strength         0--25                   Formal tender/RFP \>
                                                  explicit scouting \>
                                                  expansion hint \> market
                                                  rumour.

  Requirement specificity 0--20                   Exact size + location +
                                                  timing scores higher than
                                                  vague demand.

  Source trust            0--15                   Official
                                                  tender/first-party company
                                                  source \> reputable media
                                                  \> aggregator/social.

  Location relevance      0--15                   Requirement falls within
                                                  client-served
                                                  corridor/geography.

  Recency                 0--10                   New signal scores higher;
                                                  older open tenders can use
                                                  deadline-aware decay.

  Corroboration           0--10                   Independent sources
                                                  referring to same
                                                  requirement.

  Contact/actionability   0--5                    Named tender
                                                  authority/decision-maker
                                                  or clear route to contact.
  --------------------------------------------------------------------------

Example: a formal government tender with exact 150,000 sqft requirement
in Ahmedabad, a closing date, and a named procurement cell could score
85--95. A general article saying 'textile exporters are seeing more
warehouse demand' should remain a watch signal, not a sales-ready lead.

## 6.2 Warehouse-fit score (0--100)

  -----------------------------------------------------------------------
  Component               Suggested weight        What is compared
  ----------------------- ----------------------- -----------------------
  Location / travel       35%                     Lead corridor/city vs
  radius                                          warehouse location.

  Available capacity      25%                     Requested area vs
                                                  currently available
                                                  usable area.

  Facility capability     20%                     Cold chain, bonded,
                                                  hazmat, Grade A/GMP,
                                                  floor/load/height, etc.

  Industry suitability    10%                     Property restrictions
                                                  or proven industry fit.

  Availability timing     10%                     Required-by date vs
                                                  available-from date.
  -----------------------------------------------------------------------

# 7. Suggested data model

Use tenantId/organizationId on every business record from day one, even
if the initial deployment has only one client.

  ------------------------------------------------------------------------------
  Entity                              Purpose / key fields
  ----------------------------------- ------------------------------------------
  organizations                       tenantId, name, plan, default geography,
                                      scoring config, notification config.

  users                               userSub, tenantId, name, email, role,
                                      active.

  warehouses                          name, address, lat/lng, corridor,
                                      totalSqft, availableSqft, facilityType,
                                      capabilities, availableFrom, status.

  sources                             name, type, connectorType, endpoint,
                                      language, trustTier, schedule, enabled,
                                      secretRef.

  source_runs                         sourceId, startedAt, completedAt, status,
                                      itemCount, error, cursor/watermark.

  documents                           sourceId, canonicalUrl, title,
                                      publishedAt, rawS3Key, textS3Key,
                                      language, contentHash, mimeType.

  extractions                         documentId, modelId, schemaVersion,
                                      structuredJson, evidenceJson, createdAt,
                                      status.

  leads                               company, industry, intent,
                                      requirementType, area/value+unit,
                                      location, deadline, confidence, status,
                                      assignee.

  lead_sources                        leadId, documentId,
                                      relationshipType(primary/corroboration),
                                      sourceContribution.

  lead_score_components               leadId, component, score, maxScore,
                                      reason, configVersion.

  lead_warehouse_matches              leadId, warehouseId, fitScore,
                                      componentJson, status/overrideReason.

  lead_notes / activities             leadId, userId, type, note, timestamp,
                                      nextActionAt.

  lead_outcomes                       leadId, won/lost, value, warehouseId,
                                      reason, closedAt.

  notifications                       leadId/reportId, channel, recipient,
                                      status, sentAt.

  audit_log                           actor, action, entityType, entityId,
                                      before/after metadata, timestamp.
  ------------------------------------------------------------------------------

# 8. Bedrock extraction contract

The model should return a validated JSON object, not free-form prose. A
simplified contract:

  -----------------------------------------------------------------------
  { "isRelevant": true, "organizationName": "string \| null", "industry":
  "string \| null", "intent": "tender \| rfp \| scouting \| expansion \|
  land \| watch", "requirementType": "lease \| hire \| build_to_suit \|
  buy \| land \| unknown", "size": { "value": 150000, "unit": "sqft" },
  "location": { "state": "Gujarat", "city": "Ahmedabad", "corridor":
  "Aslali", "rawText": "..." }, "specialRequirements": \["cold_storage",
  "bonded"\], "deadline": "YYYY-MM-DD \| null", "leaseTermMonths": null,
  "contact": { "name": null, "role": null, "organization": null },
  "tenderReference": "string \| null", "evidence": \[ { "field": "size",
  "quote": "..." }, { "field": "location", "quote": "..." } \],
  "reasoningSummary": "Short explainable classification summary" }
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## Extraction rules

Do not infer exact size, city, contact or deadline when the source does
not state it.

Every high-impact extracted field should have evidence text or a source
pointer.

Normalize Indian units: lakh sqft → sqft; acres remain acres unless
explicitly converted for matching.

Keep the raw location phrase in addition to normalized geography.

Version the prompt/schema so old leads can be reprocessed when
extraction improves.

Log token/model usage per document for cost analysis.

# 9. Recommended AWS + SST architecture

Use SST v4 to define and deploy the AWS resources. Keep ingestion
asynchronous so a slow source, PDF, or model request cannot block the
user-facing API.

R&D database decision: use Neon Postgres instead of Aurora Serverless
v2. Neon remains standard PostgreSQL, so the schema and SQL design do
not change. Store DATABASE_URL in AWS Secrets Manager/SST secrets, place
the Neon project in a region close to the AWS Lambda region, and use
Neon's pooled endpoint or @neondatabase/serverless for Lambda-friendly
connections.

  -----------------------------------------------------------------------
  Stage                               AWS / application component
  ----------------------------------- -----------------------------------
  1\. Schedule / ingest               EventBridge Scheduler / SES inbound
                                      / manual submission

  2\. Collect                         Source-specific Lambda collectors

  3\. Queue                           SQS ingestion queue + DLQ

  4\. Raw archive                     S3 raw documents + normalized text

  5\. Extract                         Lambda → Amazon Bedrock Structured
                                      Outputs

  6\. Correlate                       Dedup/corroboration + scoring
                                      service

  7\. Store                           Neon Postgres

  8\. Match                           Lead-to-warehouse matcher

  9\. Serve                           API Gateway + Lambda APIs

  10\. UI / alerts                    Next.js/React dashboard + SES
                                      alerts/digests
  -----------------------------------------------------------------------

## Why these components

  -----------------------------------------------------------------------
  Component                           Recommendation
  ----------------------------------- -----------------------------------
  SST v4                              Infrastructure-as-code and
                                      deployment layer for the AWS-first
                                      TypeScript project.

  Next.js / React                     Production version of the current
                                      React demo; responsive dashboard
                                      and admin UI.

  Amazon Cognito                      Authentication and tenant/role
                                      claims; no need to build auth from
                                      scratch.

  API Gateway + Lambda                CRUD/search/workflow APIs;
                                      serverless and familiar for
                                      Node/TypeScript.

  EventBridge Scheduler               Recurring source scans; managed
                                      cron/rate schedules with retry
                                      controls.

  SQS + DLQ                           Backpressure, retries and isolation
                                      between collection and processing.

  S3                                  Immutable raw evidence, tender
                                      PDFs, newsletter emails and
                                      normalized text.

  Amazon Bedrock                      Relevance, intent,
                                      entity/requirement extraction and
                                      explanations using structured JSON
                                      output.

  Neon Postgres                       Relational lead workflow, joins,
                                      filters, reporting and tenant data;
                                      autoscaling and
                                      autosuspend/scale-to-zero are
                                      suitable for intermittent R&D and
                                      MVP workloads.

  SES                                 Inbound newsletter ingestion and
                                      outbound lead/digest email.

  CloudWatch                          Logs, metrics, alarms and
                                      operational dashboards.

  Secrets Manager / SST secrets       API keys and source credentials.

  OpenSearch Serverless               Optional later for larger
                                      full-text/semantic search
                                      workloads; PostgreSQL search is
                                      sufficient for MVP.

  Step Functions                      Optional when a per-document
                                      pipeline becomes long/branching and
                                      needs visible orchestration; not
                                      mandatory for first release.
  -----------------------------------------------------------------------

## Suggested repository layout

  -----------------------------------------------------------------------
  apps/ web/ \# Next.js/React dashboard packages/ core/ \# domain types,
  scoring, matching db/ \# schema, migrations, repositories connectors/
  \# news, tender, RSS, email adapters ai/ \# Bedrock prompts, schemas,
  extraction shared/ \# validation, logging, auth helpers functions/ api/
  collectors/ normalize/ extract/ correlate/ notify/ infra/ sst.config.ts
  \# SST v4 resources and stage config
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 10. API surface

  -----------------------------------------------------------------------
  Area                                Example endpoints
  ----------------------------------- -----------------------------------
  Leads                               GET /leads, GET /leads/:id, PATCH
                                      /leads/:id, POST /leads/:id/status,
                                      POST /leads/:id/assign

  Evidence                            GET /leads/:id/sources, GET
                                      /documents/:id, POST
                                      /leads/:id/corroborate

  Activities                          POST /leads/:id/notes, POST
                                      /leads/:id/activities, POST
                                      /leads/:id/outcome

  Warehouses                          GET/POST/PATCH /warehouses, GET
                                      /warehouses/:id/matches

  Sources                             GET/POST/PATCH /sources, POST
                                      /sources/:id/test, POST
                                      /sources/:id/run

  Rules                               GET/PATCH /settings/scoring,
                                      GET/PATCH /settings/queries

  Dashboard                           GET /dashboard/summary, GET
                                      /dashboard/source-performance, GET
                                      /dashboard/conversion

  Exports                             POST /exports/leads, GET
                                      /exports/:id

  Manual ingestion                    POST /documents/url, POST
                                      /documents/upload, POST
                                      /leads/manual
  -----------------------------------------------------------------------

# 11. UI screens to build

Login / organization selection.

Dashboard with new signals, review backlog, contacted leads, source
health and won value.

Lead Inbox mirroring the supplied demo with filters, confidence, source
and requirement summary.

Lead detail drawer/page with evidence, exact source, extracted data,
confidence reasons, matched warehouses and activity.

Approved/Contacted/Rejected pipeline views.

Warehouse portfolio list and warehouse detail/edit form.

Source management page with connector health and last-run status.

Keyword/query rule page by geography/industry/requirement type.

Scoring configuration page.

Notification preferences and digest settings.

Analytics/reporting page.

Admin users/roles page.

# 12. Non-functional requirements

  -----------------------------------------------------------------------
  Area                                Requirement
  ----------------------------------- -----------------------------------
  Traceability                        Every lead must link to its
                                      evidence. Store raw source/document
                                      reference and extraction version.

  Reliability                         Idempotent collectors, SQS retries,
                                      DLQs, source-level failure
                                      isolation.

  Security                            Tenant isolation, least-privilege
                                      IAM, encrypted S3 and encrypted
                                      Neon Postgres, secrets management,
                                      audit log.

  Privacy                             Store only business/public contact
                                      data needed for the workflow;
                                      define retention and deletion
                                      policy.

  Performance                         Lead list/filter response target
                                      under \~2 seconds for normal tenant
                                      sizes; process ingestion
                                      asynchronously.

  Freshness                           Configurable source cadence;
                                      high-priority tender/news sources
                                      typically every 15--60 minutes
                                      where allowed.

  Explainability                      Confidence and warehouse-fit scores
                                      must show component reasons; human
                                      reviewer can correct AI fields.

  Cost control                        Batch low-priority extraction, use
                                      smaller supported Bedrock models
                                      for classification, invoke stronger
                                      model only when needed, Neon
                                      autosuspend/scale-to-zero for
                                      non-production databases.

  Observability                       Per-source success/failure rate,
                                      ingestion latency, model failures,
                                      queue depth, duplicate rate,
                                      false-positive rate.

  Compliance                          Respect publication/tender terms,
                                      robots/access restrictions, API
                                      licenses and content-retention
                                      rights.
  -----------------------------------------------------------------------

# 13. Product success metrics

Precision: percentage of surfaced signals that reviewers consider
genuinely relevant.

Actionability: percentage of approved leads that are contacted.

Freshness: time between source publication and platform availability.

Coverage: number of useful unique requirements found per
source/corridor.

Deduplication quality: duplicate cards per underlying requirement.

Conversion: approved → contacted → won.

Attributed value: total won deal value sourced by the platform.

Source ROI: useful leads and won value per source relative to
subscription/engineering cost.

# 14. Recommended delivery phases

  -------------------------------------------------------------------------
  Phase                   Scope                    Exit criteria
  ----------------------- ------------------------ ------------------------
  Phase 0 --- Discovery   Finalize client          Signed source matrix +
                          warehouse inventory,     extraction schema +
                          target geography,        warehouse fields +
                          industries, must-monitor acceptance examples.
                          publications/portals,    
                          legal access methods,    
                          lead definition and      
                          scoring weights.         

  Phase 1 --- MVP         SST/AWS foundation,      Real signals arrive
  intelligence pipeline   auth, PostgreSQL, S3,    automatically with
                          Scheduler, SQS, 3--5     evidence and explainable
                          source adapters, Bedrock confidence.
                          structured extraction,   
                          dedup, lead              
                          inbox/detail,            
                          approve/reject.          

  Phase 2 --- Warehouse   Warehouse portfolio, fit Sales team can work a
  matching + workflow     scoring, assignee,       lead end-to-end and
                          notes, contacted,        attribute outcome.
                          won/lost, export and     
                          email digests.           

  Phase 3 --- Coverage &  More                     Useful coverage across
  quality                 tender/news/newsletter   all agreed corridors;
                          sources, source health,  false positives measured
                          translation, PDF OCR,    and reduced.
                          better correlation,      
                          analyst feedback loop.   

  Phase 4 --- Scale &     Semantic                 Higher automation
  intelligence            search/OpenSearch if     without losing
                          needed, advanced         evidence/traceability.
                          analytics, CRM           
                          integration, Slack/Teams 
                          alerts, contact          
                          enrichment through       
                          licensed providers.      
  -------------------------------------------------------------------------

## Suggested MVP source order

1.  CPPP/eProcure and one Gujarat/state tender source.

2.  News API or equivalent licensed news search for business/expansion
    signals.

3.  Selected publication/company RSS feeds.

4.  Inbound newsletter email via SES.

5.  Manual URL submission for analyst-discovered items.

6.  Only after these are stable: social and commercial tender
    aggregators.

# 15. Key technical decisions before coding

  -----------------------------------------------------------------------
  Decision                            Recommended default
  ----------------------------------- -----------------------------------
  Initial geography                   Gujarat corridors where the client
                                      actually owns/serves warehouses; do
                                      not start pan-India unless
                                      required.

  Database                            Neon Postgres; tenant-aware schema.

  Search                              PostgreSQL text/filtering first;
                                      OpenSearch Serverless only after
                                      measured need.

  AI API                              Amazon Bedrock Converse/InvokeModel
                                      using Structured Outputs and a
                                      strict JSON Schema.

  Model selection                     Benchmark 2--3 Bedrock models on a
                                      labelled sample; choose smallest
                                      model meeting extraction precision
                                      target.

  Pipeline orchestration              Scheduler + SQS + Lambda for MVP;
                                      Step Functions only for workflows
                                      that truly need explicit multi-step
                                      orchestration.

  Frontend                            Next.js/React; reuse the demo's
                                      visual language and interaction
                                      model.

  IaC                                 SST v4.

  News acquisition                    Licensed API/RSS/official feeds; do
                                      not depend on search-engine
                                      scraping.

  Social acquisition                  Official/licensed access or manual
                                      analyst submission.

  Confidence                          Deterministic weighted score + AI
                                      evidence, not an opaque LLM
                                      percentage.
  -----------------------------------------------------------------------

# 16. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Source blocks automation / captcha  Use official API/feed, licensed
  / login                             aggregator, email subscription, or
                                      manual connector. Design source
                                      adapters to be replaceable.

  News API returns snippet, not full  Use it for discovery; fetch/process
  licensed article body               source content only where
                                      permitted, otherwise extract from
                                      available metadata/snippet and mark
                                      evidence level.

  LLM hallucinates missing            Strict schema, explicit null
  requirement details                 policy, evidence per field, human
                                      review, deterministic validation.

  Many articles describe market       Relevance classifier + rule
  demand but no actual occupier       requiring a named
                                      organization/official procurement
                                      or explicit action language for
                                      high-confidence leads.

  Same requirement appears repeatedly Canonical URL/hash +
                                      entity/location/size/time
                                      correlation and lead-source join
                                      model.

  High AI cost                        Cheap first-pass classifier, only
                                      extract relevant documents, cache
                                      by content hash, batch low-priority
                                      items, monitor token spend.

  Warehouse availability changes      Make availability a first-class
                                      field with effective dates; re-run
                                      fit score when inventory changes.

  Legal/content rights                Store minimal excerpts/metadata if
                                      full content cannot be retained;
                                      link back to original; document
                                      source terms.
  -----------------------------------------------------------------------

# 17. MVP acceptance criteria

☐ At least 3 production source connectors ingest new items automatically
on schedule.

☐ Each ingested document is archived/referenced and processed
idempotently.

☐ Relevant warehouse signals are extracted into the agreed JSON schema
with evidence.

☐ Duplicate/corroborating items are merged into one lead.

☐ Lead confidence is calculated from visible components.

☐ Users can search/filter the inbox and open exact evidence.

☐ Users can approve, reject, assign, mark contacted, add notes and
record won/lost.

☐ Client warehouse records can be created/edited and each lead receives
ranked warehouse matches.

☐ Daily email digest is generated from stored leads.

☐ Source failures go to monitoring/DLQ and do not stop other sources.

☐ All business data is tenant-scoped and protected by role-based
authorization.

☐ Dashboard shows at minimum new, awaiting review, approved/contacted
and won value.

# 18. Current platform/technology notes (verified August 2026)

SST: SST's current migration guidance is v4; v4 upgrades the underlying
Pulumi AWS provider and is the sensible baseline for a new SST project.

Amazon Bedrock: Structured Outputs can enforce a JSON Schema for model
responses, making it suitable for reliable requirement extraction.

EventBridge Scheduler: AWS recommends EventBridge Scheduler for managed
recurring schedules; it supports cron/rate schedules, retries and
flexible delivery windows.

Aurora Serverless v2: Neon is a serverless Postgres platform with
autoscaling and scale-to-zero, making it well suited to R&D, development
and early MVP workloads where the database may sit idle for long
periods.

OpenSearch Serverless: Current Serverless search collections support
full-text search; vector collections support similarity plus filtering.
Treat this as an optional scale feature, not an MVP dependency.

News API: The Everything endpoint supports keyword/phrase queries,
domains, dates, languages and sorting and is suitable as an
article-discovery source.

CPPP/eProcure: The Government of India procurement portal publishes
tender enquiries, corrigenda and award details and provides active
tender search. It is a high-value source for formal demand signals.

SES inbound: Amazon SES can invoke Lambda and/or store incoming email in
S3, which makes it useful for ingesting subscribed trade newsletters.

## References

SST --- Migrate From v3 / SST v4 guidance

Amazon Bedrock --- Structured Outputs

Amazon EventBridge Scheduler

Neon Postgres documentation

Amazon OpenSearch Serverless

News API --- Everything endpoint

Government of India ePublishing / CPPP

Amazon SES --- receiving email with Lambda

GDELT Project --- Context/DOC API family

  -----------------------------------------------------------------------
  Next specification step Before implementation, convert this document
  into a source-by-source connector matrix using the client's actual
  target publications/tender portals and warehouse inventory. That will
  determine the ingestion effort and will allow a realistic backend
  timeline and server-cost estimate.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
