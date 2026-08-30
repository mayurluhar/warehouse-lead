# Replicable Stack & Architecture Blueprint (PulseCX Monorepo derived)

This blueprint document acts as a complete guide for recreating the technology stack, project layout, clean architecture layering, coding standards, database patterns, and testing strategies from the current project. It is structured to be parsed by code generation models to reproduce the exact setup for a twin project (e.g., in the logistics sector).

> **Persistence note (updated):** DynamoDB is the **default/primary datastore**. However, the persistence layer is deliberately built as a **switchable adapter** behind store-neutral repository Ports, so the entire system can be swapped to a **SQL database (e.g., PostgreSQL)** by changing a single configuration value — with **no changes to the domain or application layers**. See **Section 8** for the full switchable-persistence design.

---

## 1. Architectural Philosophy (Clean Architecture)

The codebase strictly adheres to **Clean Architecture** and **Ports & Adapters (Hexagonal Architecture)**. This ensures that the core business domain rules and use cases remain isolated from external frameworks, AWS infrastructure, or third-party integrations. Critically, this isolation is what makes the datastore **swappable**: the domain talks only to repository interfaces (Ports), never to a concrete database.

### The Four-Layer Flow
Execution flow always moves in a single direction from the outer presentation layer inward:

```
[Presentation/Entry]  -->  [Application Workflow]  -->  [Domain Business Rules]  -->  [Infrastructure Persist/Adapters]
      Handlers                 Use Cases                  Services                 Repositories & Adapters
(packages/functions/src/)   (core/src/domains/*/use-cases/)  (core/src/domains/*/)     (core/src/infrastructure/)
```

1. **Handlers (Presentation Layer - [packages/functions/src/](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/functions/src/))**:
   * AWS Lambda entry points (typically wrapping a [Hono](https://hono.dev) application).
   * **Responsibility**: Parse events (HTTP requests, SQS events, Step Functions inputs), extract security context (JWT), invoke the corresponding Use Case, and wrap/envelope the response. Handlers contain no business logic.
   * **Composition Root**: Handlers serve as the Composition Root where concrete infrastructure implementations are instantiated and injected into Use Cases and Services. This is the **only** layer that knows which datastore is active — it asks the `RepositoryFactory` (Section 8.5) for the correct concrete repositories.
2. **Use Cases (Application Layer - [core/src/domains/<domain>/use-cases/](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/core/src/domains/))**:
   * **Responsibility**: Orchestrate application-specific workflows. They validate input parameters, execute security checks (Authorization Guards), map Data Transfer Objects (DTOs) to Domain Entities, coordinate services, and return DTOs or entities back to Handlers.
   * Extends the base class [UseCase](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/core/src/common/UseCase.ts) and implements `handle(input, context)`.
3. **Services (Domain Layer - [core/src/domains/<domain>/](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/core/src/domains/))**:
   * **Responsibility**: Implement core business calculations, domain-specific validation rules, and coordinate repositories (Fetch-Modify-Persist loop).
   * Services coordinate one or more Repositories for a single domain boundary. Cross-domain orchestration is handled in Use Cases, not in Domain Services.
4. **Repositories & Adapters (Infrastructure Layer - [core/src/infrastructure/](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/core/src/infrastructure/))**:
   * **Responsibility**: Abstract all details of data persistence (DynamoDB adapter by default; Drizzle ORM for PostgreSQL as the swappable alternative) and third-party interactions (AWS S3, Bedrock, Cognito, SES).
   * Concrete classes implement interface contracts (Ports) declared in the Domain layer. **Each aggregate has two interchangeable repository implementations — one per store — that satisfy the identical Port** and are selected at runtime by configuration.

---

## 2. Technology Stack & Key Versions

The project is structured as a TypeScript-first monorepo using standard NPM/PNPM workspaces:

* **Node.js**: targeting version `20.x` or `24.x` (AWS Lambda runtime is `nodejs24.x`).
* **Package Manager**: NPM or PNPM workspace manager.
* **Infrastructure**: [SST v3 (Ion)](https://sst.dev) built on top of [Pulumi](https://www.pulumi.com) and AWS CDK for serverless infrastructure mapping.
* **Database & Persistence (switchable)**:
  * **Primary store — DynamoDB (default)**: single-table design accessed through a custom `DynamoDBAdapter` wrapper. Used for all domain aggregates as well as configuration, tenancy details, and caching. Active when `DATABASE_PROVIDER=dynamodb`.
  * **Swappable relational store — PostgreSQL**: Aurora Serverless PostgreSQL V2 using [Drizzle ORM](https://orm.drizzle.team) (`^0.45.2`) and `drizzle-kit` (`^0.31.8`) for migrations. Active when `DATABASE_PROVIDER=postgres`.
  * **Switchability contract**: Both stores sit behind identical repository **Ports**. The active store is chosen by a single stage config value at the Composition Root. Switching stores requires **no changes to domains, use cases, services, or handlers** — only a config flip plus provisioning/migrating the target store. See **Section 8**.
* **Backend Framework**: [Hono](https://hono.dev) (`^4.0.0`) with `@hono/zod-openapi` (`^1.2.1`) for strict route specifications, OpenAPI documentation generation, and Zod input validation.
* **Authentication**: AWS Cognito (using custom User Pools and Admin User Pools).
* **AI & Machine Learning**: AWS Bedrock (Claude 3 Haiku and Sonnet models) via `@aws-sdk/client-bedrock-runtime`, and AWS Transcribe Call Analytics for audio ingestion.
* **Communications**: AWS SES via JSX email rendering (`@react-email/components` `^0.0.36` and `@react-email/render` `^1.0.5`).
* **Frontend**: React 18/19 app bundled with Vite (`^7.3.0`), styled with TailwindCSS (`^3.4.3`) and [Shadcn UI](https://ui.shadcn.com/) components, using Redux Toolkit (`^2.2.5`) for client state management, date-fns, lucide-react icons, and Recharts/Chart.js.
* **Testing**: [Vitest](https://vitest.dev) (`^4.0.16`) for unit, component, workflow, and integration tests — including a **repository contract suite** run against every store adapter to guarantee parity (Section 10).

---

## 3. Monorepo Structure & Package Relationships

The project structure keeps business logic separate from infrastructure entrypoints:

```
├── packages/
│   ├── core/           # Business domain modules, use cases, services, repos, ports (pure logic)
│   │   └── src/
│   │       ├── common/           # Base UseCase, RequestContext, shared value objects
│   │       ├── domains/          # Domain aggregates: entities, services, use-cases, ports (interfaces)
│   │       └── infrastructure/
│   │           └── persistence/
│   │               ├── RepositoryFactory.ts   # Picks the active store based on DATABASE_PROVIDER
│   │               ├── query/                 # QuerySpec, cursor/pagination, shared query contracts
│   │               ├── inmemory/              # In-memory adapters (testing + local dev)
│   │               ├── dynamodb/              # DynamoDBAdapter + Dynamo repository implementations
│   │               └── postgres/              # Drizzle schema, migrations, Postgres repository implementations
│   ├── functions/      # Lambda handlers (API apps, connectors, SQS, Step Functions, migrations)
│   ├── api-schemas/    # OpenAPI schema declarations and routes mapping (shared with functions & frontend)
│   ├── web/            # React frontend application
│   └── emails/         # React Email templates
├── stacks/             # SST infrastructure stack resources (DynamoDB tables, RDS, S3, Cognito, API Gateways, SQS, etc.)
├── sst.config.ts       # SST v3 infrastructure entrypoint
├── infra.config.ts     # Stage-aware environment variable config values (incl. DATABASE_PROVIDER)
├── package.json        # Root package workspace definition
└── tsconfig.json       # Monorepo TypeScript configuration
```

### Dependency Rules between Packages
* **Core** is the source of truth for business logic. It must **never** depend on `functions/`, `api-schemas/`, or Hono routes. It uses plain `zod` for model schemas. Repository **Ports** (interfaces) live in Core; both concrete store adapters also live in Core under `infrastructure/persistence/`, but nothing outside a Port is imported by domains/use-cases.
* **Api-Schemas** depends on **Core** Zod schemas. Because Hono OpenAPI expects `.openapi()` decorators which are absent from Core (to prevent Hono leaking into Core), Api-Schemas reconstructs core schemas like this:
  ```typescript
  import { CoreSchema } from "@pulsecx-backend/core/domains/scorecard/use-cases/schemas";
  import { z } from "@hono/zod-openapi";

  export const ApiScorecardSchema = z.object(CoreSchema.shape).openapi("Scorecard");
  ```
* **Functions** imports routes from **Api-Schemas** and business logic/use cases from **Core**. As the Composition Root, it also imports the `RepositoryFactory` to resolve the active store's repositories.
* **Web** client imports Typescript type definitions from **Core** and **Api-Schemas** to ensure compile-time API request/response safety.

---

## 4. Key Coding Conventions

### Dependency Injection (DI) and the `deps` Pattern
* Avoid default constructor instantiations or hardcoded dependencies inside Use Cases and Services. Everything must be explicitly injected.
* To prevent long, fragile lists of positional arguments, **always use a single `deps` object argument** in constructors:
  ```typescript
  // ✅ DO
  constructor(deps: { 
    tenantRepository: ITenantRepository; 
    userManagementService: IUserManagementProvider;
  }) {
    this.tenantRepository = deps.tenantRepository;
    this.userManagementService = deps.userManagementService;
  }

  // ❌ DON'T (Positional arguments are fragile)
  constructor(repo: ITenantRepository, service: IUserManagementProvider) { ... }

  // ❌ DON'T (Leaks concrete infrastructure details into Core/Domain)
  constructor(repo = new TenantRepository()) { ... }
  ```
* **Store-agnostic DI rule**: Use Cases and Services depend **only on Port interfaces** (`ITenantRepository`), never on a concrete `DynamoTenantRepository` or `PostgresTenantRepository`. Concrete selection happens exclusively at the Composition Root via the `RepositoryFactory`.

### Naming Conventions
* **Rule**: `FileName == ClassName == LoggerName`.
  * **File**: `GetTenantUseCase.ts`
  * **Class**: `export class GetTenantUseCase`
  * **Logger**: `const logger = getLogger("GetTenantUseCase");`
* **Variable/Function Names**: camelCase.
* **Interfaces & Classes**: PascalCase.
* **Database Entities**: `[Name]Entity`, `Create[Name]Input`, `Update[Name]Input`.
* **Repository Interfaces (Ports)**: prefix with `I` (e.g., `ICoachingRepository`).
* **Concrete Repositories**: prefix with the store name (e.g., `DynamoCoachingRepository`, `PostgresCoachingRepository`, `InMemoryCoachingRepository`).

### Null vs. Undefined
* Use `null` for values originating from or heading to the database.
* Use `undefined` for optional property definitions in TypeScript interfaces and schemas.

---

## 5. Security & Multi-Tenancy

Every stored record and API request must enforce tenant isolation. Because the datastore is swappable, tenant scoping is enforced **at the repository/adapter level in a store-neutral way** — the rule is identical whether the active store is DynamoDB or PostgreSQL:

1. **JWT Extraction**: The user's Cognito JWT is passed in the `Authorization` header.
2. **Context Creation**: The [authMiddleware.ts](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/functions/src/api/shared/authMiddleware.ts) parses the JWT, extracts `tenantId`, `userSub`, and tenant modules, and stores them in Hono's `Context` variables.
3. **URL Param Validation**: The middleware verifies if a `:tenantId` parameter is present in the path. If it exists, it must match the `tenantId` in the JWT token (fail-closed check).
4. **Use Case Scoping**: Use Cases enforce permission checks via `assertTenantAccess(context)` as the first instruction. Use Cases retrieve `tenantId` strictly from the `RequestContext` argument—never from the request body or raw inputs.
5. **Database Scoping (store-neutral)**: Every repository **Port** method takes `tenantId` as a required argument, and each adapter enforces it in its own idiom. Repositories must throw if `tenantId` is missing from the query filters.
   * **DynamoDB adapter**: `tenantId` is baked into the partition key (e.g., `PK = TENANT#<tenantId>`), so cross-tenant reads are structurally impossible.
   * **PostgreSQL adapter**: every query includes an explicit `eq(table.tenantId, tenantId)` constraint (and, where used, RLS policies as a second line of defense).

---

## 6. The Base Use Case & Authorization Guards

Every application workflow extends the [UseCase](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/core/src/common/UseCase.ts) base class, which handles authn/authz pipeline checks:

```typescript
export abstract class UseCase<TInput, TOutput> {
  abstract readonly permission: PermissionType | NoPermissionType;
  readonly module?: string; // Gated platform module (e.g. ModuleId.COACHING)
  readonly requireTenantAccess: boolean = true;

  protected abstract handle(input: TInput, context?: RequestContext): Promise<TOutput>;

  async execute(input: TInput, context?: RequestContext): Promise<TOutput> {
    if (this.requireTenantAccess) {
      assertAuthenticated(context);
      assertTenantAccess(context);
    }
    if (this.module) {
      assertModuleEnabled(context, this.module);
    }
    if (isEnforceablePermission(this.permission)) {
      assertPermission(context, this.permission);
    }
    return this.handle(input, context);
  }
}
```

If permissions are checked dynamically in code rather than class declaration level, use case declarations specify a `NoPermission` sentinel like `Permission.CHECKED_INTERNALLY`, `Permission.PUBLIC_TO_MEMBER`, or `Permission.INTERNAL_LAMBDA`.

---

## 7. API Request/Response Standards

### Two-File Split for Hono Handlers
Each API domain is divided into two separate files to prevent tests from executing production setup side-effects:
1. **`<domain>.app.ts`**: Contains route mappings and the app setup factory. It does not import concrete repositories. Integration tests import this file.
2. **`<domain>.ts`**: Wires concrete repositories (resolved from the `RepositoryFactory`, e.g., a `DynamoCoachingRepository` or `PostgresCoachingRepository`) and AWS adapters (e.g., `BedrockAIProvider`) and exports the Lambda handler. It is never imported by tests.

### Envelope Standards
All success and error responses use standard response envelopes:
* **Single Object Success**: `{ success: true, data: { ... } }` (HTTP status `200` or `201`).
* **Paginated List Success**: `{ success: true, data: [...], meta: { total, page, limit, totalPages, nextCursor } }` (HTTP status `200`). `nextCursor` is the store-neutral opaque pagination token (Section 8.3); `page`/`total` are populated only where the active store can compute them cheaply.
* **Void Mutation Success**: `{ success: true }` (HTTP status `200` or `201`).
* **Validation Error (400)**: `{ success: false, message: "Validation failed", details: [{ path: "field.name", message: "Error text" }] }`.
* **Other Errors**: `{ success: false, message: "Error description text" }`.

### Global Error Mapping
No try/catch blocks are placed in handlers. Instead, the global Hono `onError` hook intercepts errors and matches error message keywords to HTTP statuses:
* `instanceof ZodError` $\rightarrow$ `400 Bad Request`
* `instanceof UnauthorizedError` or includes `"forbidden"` $\rightarrow$ `403 Forbidden`
* Includes `"not found"` $\rightarrow$ `404 Not Found`
* Includes `"conflict"` or `"already"` $\rightarrow$ `409 Conflict`
* Unhandled exception $\rightarrow$ `500 Internal Server Error`

Persistence adapters translate store-specific errors into these portable domain errors (e.g., a DynamoDB `ConditionalCheckFailedException` and a Postgres unique-constraint violation both surface as a `"conflict"` error), so the mapping is identical regardless of the active store.

---

## 8. Database Strategy & Switchable Persistence

**Design goal:** DynamoDB is the default/primary store, but the persistence layer is a **pluggable adapter chosen by configuration**. The domain and application layers never know which store is active, so switching to PostgreSQL (or any SQL store) is a **config change + deploy**, not a rewrite.

Seven rules make this possible.

### 8.1 Store-agnostic domain model (one canonical entity)
* Each aggregate's entity is defined **once** in the domain layer as plain, framework-free TypeScript — a class with a validating constructor plus an immutable `.with(updates)` helper that returns a new instance with merged properties.
* Entities are **never** inferred from a Drizzle schema (`$inferSelect` / `$inferInsert`) and **never** shaped around a DynamoDB item, because either would couple the domain to a single store.
* Cross-cutting fields (`id`, `tenantId`, `createdAt`, `updatedAt`, `version`) live on the canonical entity and are populated **in code**, not by the database:
  * **IDs** are application-generated (UUID/ULID) so behavior is identical across stores.
  * **Timestamps** are set by the domain/use case.
  * **`version`** supports optimistic concurrency in both stores.
* Business logic is expressed as instance methods on the entity (e.g., `tenant.canIngest()`), keeping it store-independent.

### 8.2 Repository Ports (interfaces) live in the domain
* Every aggregate has an interface, e.g. `ICoachingRepository`, declared under `core/src/domains/<domain>/ports/`.
* Method contracts are **store-neutral and intention-revealing**: `findById`, `findByTenant`, `save`, `delete`, `findMany(spec)`. No method exposes a Drizzle query builder or a DynamoDB expression.
* Every method takes `tenantId` as a required argument (Section 5).
* Repositories accept and return **canonical domain entities** (or `null`) — never raw rows or Dynamo items.

```typescript
export interface ICoachingRepository {
  findById(id: string, tenantId: string): Promise<CoachingTip | null>;
  findMany(spec: QuerySpec<CoachingTip>, tenantId: string): Promise<Page<CoachingTip>>;
  save(tip: CoachingTip, tenantId: string): Promise<CoachingTip>;
  delete(id: string, tenantId: string): Promise<void>;
}
```

### 8.3 Query / Specification abstraction (the hard part)
DynamoDB and SQL differ sharply in query power, so queries are expressed in a way **both** stores can honor:
* **Prefer named, intention-revealing methods** (`findActiveByTenant(tenantId)`) over a generic query builder. Each adapter implements them optimally — a GSI query in Dynamo, a `WHERE` clause in SQL.
* For list/filter endpoints, use a small **`QuerySpec`** DTO: `{ filters, sort, pagination }` with a **whitelisted, per-aggregate filter/sort vocabulary**. Each adapter translates it (Dynamo → `KeyConditionExpression` / `FilterExpression` + GSI; Postgres → Drizzle `where` / `orderBy`).
* Portability constraints that keep both stores honest:
  * Filterable/sortable fields are declared per aggregate up front, so DynamoDB can back them with keys/GSIs (no surprise scans).
  * **No arbitrary joins** cross the Port — compose across aggregates in the Use Case instead. This mirrors DynamoDB's single-table access-pattern discipline.
  * **Pagination is cursor / opaque-token based, never offset.** The `nextCursor` maps to a DynamoDB `LastEvaluatedKey` or a SQL keyset cursor. Offset paging is banned because DynamoDB cannot do it efficiently.

### 8.4 Concrete adapters (one per store, same Port)
* **`DynamoCoachingRepository` (default)** — uses the `DynamoDBAdapter` wrapper over single-table design; keys/GSIs documented per aggregate.
* **`PostgresCoachingRepository`** — Drizzle ORM against Aurora Serverless PostgreSQL; uses the Drizzle schema and `withErrorHandling`.
* **`InMemoryCoachingRepository`** — for tests and local dev (Section 10).
* All implementations satisfy the identical Port and pass the same **contract test suite** (Section 10).

### 8.5 Provider selection & Composition Root wiring
* A single stage config value **`DATABASE_PROVIDER: "dynamodb" | "postgres"`** (in `infra.config.ts`) decides the active store.
* A **`RepositoryFactory`** reads that value and returns the correct concrete repositories. It is the **only** place in the codebase that references both adapter implementations.
* Handlers (Composition Root) ask the factory for repositories and inject them into use cases:
  ```typescript
  // packages/core/.../persistence/RepositoryFactory.ts
  export function makeCoachingRepository(): ICoachingRepository {
    switch (config.DATABASE_PROVIDER) {
      case "postgres":  return new PostgresCoachingRepository({ db: getDrizzle() });
      case "dynamodb":
      default:          return new DynamoCoachingRepository({ ddb: getDynamoAdapter() });
    }
  }
  ```
* **To switch stores:** change `DATABASE_PROVIDER`, provision/migrate the target store (Section 8.7), redeploy. No domain, use case, service, or handler code changes.

### 8.6 Transactions / Unit of Work
* An **`IUnitOfWork`** Port abstracts atomic multi-write operations; use cases request atomicity through it and never call `db.transaction` or `TransactWriteItems` directly.
* **Postgres adapter** → a real SQL transaction (`db.transaction(...)`).
* **DynamoDB adapter** → `TransactWriteItems`, respecting its limits (max 100 items, single region, no cross-account). Operations that would exceed those limits are redesigned as single-aggregate writes so the abstraction stays honest on both stores.

### 8.7 Schema & migrations per store
* **DynamoDB (default):** table(s), partition/sort keys, and GSIs are declared in the SST stack. Single-table design with documented key patterns (`PK`, `SK`, `GSI1PK`, `GSI1SK`, …). No migration files; **access patterns are documented up front** and the `QuerySpec` whitelist is derived from them.
* **PostgreSQL (alternative):** Drizzle schema kept in a single [schema.ts](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/packages/core/src/infrastructure/persistence/postgres/schema.ts) file with `drizzle-kit` migrations. Provisioned and migrated **only** when `DATABASE_PROVIDER=postgres`.
* A **data-model mapping doc** keeps the three shapes in sync: `canonical entity ↔ DynamoDB item ↔ PostgreSQL row`.

### 8.8 Repository implementation rules (both stores)
* Every async data operation is wrapped in the `withErrorHandling(fn, opName)` helper:
  ```typescript
  async findById(id: string, tenantId: string): Promise<CoachingTip | null> {
    return withErrorHandling(async () => {
      const item = await this.store.getByKey(id, tenantId); // store-specific inside the adapter
      return item ? this.mapToDomain(item) : null;
    }, "findById");
  }
  ```
* Every read/write includes an explicit tenant constraint; throw if `tenantId` is missing.
* Mapping between store shape and the canonical entity is isolated in per-adapter `mapToDomain()` / `mapToPersistence()` methods.
* Adapters translate store-specific errors into portable domain errors (Section 7) so the global error mapping is store-independent.

---

## 9. Logging Principles

* **Library**: The codebase uses [AWS Lambda Powertools Logger](https://docs.aws.amazon.com/lambda/latest/dg/typescript-logging.html) (`@aws-lambda-powertools/logger`).
* **Factory Pattern**: Loggers are created using a factory helper (`getLogger(serviceName)`), never instantiated directly.
* **Structured Logs**: Context parameters are passed as structured objects—**never** interpolated in strings:
  ```typescript
  // ✅ DO
  logger.info("Retrieved scorecard details", { tenantId, scorecardId });

  // ❌ DON'T
  logger.info(`Retrieved scorecard details for tenant ${tenantId} and scorecard ${scorecardId}`);
  ```
* **Layer Discipline**:
  * **Use Cases**: Log operations at the `INFO` level.
  * **Services, Repositories, and Adapters**: Log details at the `DEBUG` level (avoiding duplicate info logs for the same workflow). Persistence adapters may include the active `provider` in the structured context (e.g., `{ provider: "dynamodb" }`) to aid cross-store debugging.
  * **Handlers/Middleware**: Log details at the `DEBUG` level, and warnings at the `WARN` level.

---

## 10. Testing Architecture

Tests are structured to run in isolation without connecting to actual AWS services:

### Test File Types
* `*.unit.test.ts`: Test a single function or class in absolute isolation. All injected dependencies are mocked using `vitest` mocks.
* `*.component.test.ts`: Test a Use Case combined with its Domain Services. Real network calls and database statements are replaced by colocated **In-Memory** repositories and **Mock** adapters.
* `*.integration.test.ts`: Spin up the Hono app instance and perform HTTP requests (`app.request()`) using fake JWTs generated with test helpers.
* `*.contract.test.ts`: **Repository parity suite** (see below).

### Colocated Mocks & In-Memory Repositories
Every repository interface has an accompanying in-memory implementation for testing (e.g. `InMemoryCoachingRepository.ts`). They implement methods like `seed()`, `seedMany()`, `clear()`, and `count()`.
External integrations have mock gateways (e.g., `MockStorageAdapter` for S3, `MockAIService` for Bedrock) with tracking functions (`wasCalled()`, `getCallCount()`).

### Repository Contract (Parity) Tests
Because the datastore is switchable, a shared conformance suite guarantees that **every adapter behaves identically** against its Port:
```typescript
// coaching.repository.contract.test.ts
function runRepositoryContract(name: string, makeRepo: () => ICoachingRepository) {
  describe(`ICoachingRepository contract — ${name}`, () => {
    it("returns null for a missing id", async () => { /* ... */ });
    it("enforces tenant isolation", async () => { /* ... */ });
    it("round-trips an entity via save/findById", async () => { /* ... */ });
    it("paginates with an opaque cursor", async () => { /* ... */ });
  });
}

runRepositoryContract("in-memory", () => new InMemoryCoachingRepository());
runRepositoryContract("dynamodb",  () => new DynamoCoachingRepository({ ddb: localDynamo() }));   // DynamoDB Local
runRepositoryContract("postgres",  () => new PostgresCoachingRepository({ db: testPg() }));       // ephemeral PG
```
The Dynamo adapter is tested against **DynamoDB Local**; the Postgres adapter against an ephemeral/Testcontainers Postgres. Passing the same suite is what makes a store switch safe.

---

## 11. Core Development Commands

| Task | Command |
| :--- | :--- |
| **Local Dev Loop** | `npm run dev` (Starts SST Live Lambda dev environment) |
| **Open SST Console** | `npm run console` |
| **Deploy Stack** | `npm run deploy -- --stage <stage-name>` |
| **Remove Stack** | `npm run remove -- --stage <stage-name>` |
| **Full Typecheck** | `npm run typecheck:all` |
| **Run Core Tests** | `npm run test --workspace=@pulsecx-backend/core` |
| **Run Functions Tests** | `npm run test --workspace=@pulsecx-backend/functions` |
| **Run Repository Contract Tests** | `npm run test:contract --workspace=@pulsecx-backend/core` |
| **Generate DB Migrations (Postgres)** | `npm run db:generate` (drizzle-kit; only when `DATABASE_PROVIDER=postgres`) |
| **Apply DB Migrations (Postgres)** | `npm run db:migrate -- --stage <stage-name>` |
| **Generate OpenAPI spec** | `npm run docs:generate` |
| **Run Docs Dev Server** | `npm run docs:dev` |
| **Check Dead Code** | `npm run knip` |

---

## How to use this blueprint for the Logistics Project
1. **Repository Setup**: Initialize a new monorepo using npm/pnpm workspaces.
2. **Copy Infrastructure**: Adopt the [sst.config.ts](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/sst.config.ts) and [infra.config.ts](file:///Users/appgambit-mac/Desktop/Work_Station/projects/pulsecx/pulsecx-sst/infra.config.ts) to declare your serverless API gateways, database instances, and Cognito configurations. Include the `DATABASE_PROVIDER` stage value and provision a DynamoDB table by default (add the Aurora Serverless PG resource only if/when you plan to switch).
3. **Core Scaffolding**: Create a `packages/core/` module with directories for `common/` (containing base `UseCase.ts` and `RequestContext.ts`), `infrastructure/persistence/` (with `RepositoryFactory.ts`, `query/`, `inmemory/`, `dynamodb/`, and `postgres/` sub-folders), and your custom domains (e.g., `shipment/`, `driver/`, `warehouse/`).
4. **Store-agnostic modeling first**: For each aggregate, define the **canonical domain entity** and its **repository Port** before writing any adapter. Then implement the DynamoDB adapter (default) and, when needed, the Postgres adapter — both satisfying the same Port and the same contract test.
5. **Ports/Adapters Injection**: Maintain the strict separation between interfaces (placed under `core/src/domains/<domain>/ports/`) and provider details (placed under `core/src/infrastructure/persistence/<store>/` and `core/src/infrastructure/services/`). Resolve concrete repositories only at the Composition Root via the `RepositoryFactory`.
6. **API & Request Validation**: Define your schemas using plain Zod in Core, map them using Hono route definitions in `packages/api-schemas/`, and wire your endpoints in Hono apps using the `.app.ts` / `.ts` split in `packages/functions/src/api/`.
7. **Prove switchability**: Keep `DATABASE_PROVIDER=dynamodb` as the default, but run the repository contract suite against both stores in CI so that flipping to `postgres` remains a safe, one-line configuration change.
