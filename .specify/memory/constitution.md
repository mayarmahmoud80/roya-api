<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.0.1
Modified principles: None
Added sections: None
Removed sections: None
Templates updated:
  - .specify/templates/plan-template.md ✅ Constitution Check now contains a
      concrete gate table for all five principles (I–V) with gate questions and
      a status column, replacing the generic placeholder.
  - .specify/templates/spec-template.md ✅ no constitution-specific changes required
  - .specify/templates/tasks-template.md ✅ no constitution-specific changes required
  - .specify/templates/agent-file-template.md ✅ no outdated references
  - .specify/templates/commands/ — directory absent, no command files to check
Deferred items: None
Version bump rationale: PATCH — plan-template Constitution Check gate table is a
  clarification/tooling improvement; no principle semantics changed.
-->

# Roya AI Plus API Constitution

## Core Principles

### I. Module-First Architecture

Every feature MUST be implemented as a self-contained NestJS module residing under
`src/modules/`. Modules MUST encapsulate their own controllers, services, models,
guards, pipes, and tests. Cross-module dependencies MUST be declared explicitly via
NestJS `imports` — no direct file imports across module boundaries without a shared
interface or common module.

**Rationale**: Enforces clear ownership, enables independent testing, and prevents
spaghetti coupling across the growing feature surface (analyses, reports, billing,
integrations, etc.).

### II. Type-Safe API Contracts

All HTTP request/response shapes MUST be declared as TypeScript classes decorated
with `class-validator` and `@nestjs/swagger` annotations. DTOs live in the `model/`
sub-directory of their module. Raw `any` types in service or controller signatures are
prohibited. Swagger documentation (`@nestjs/swagger`) MUST be kept up-to-date and
generated automatically at startup when `SWAGGER_ENABLE=1`.

**Rationale**: The API serves external clients and AI-integrated workflows. Contract
drift causes hard-to-debug integration failures; typed, documented contracts prevent
this.

### III. Security by Default

Every route MUST be protected by at least one guard unless explicitly annotated with
a documented public-access decorator. JWT-based authentication (`@nestjs/passport` +
`@nestjs/jwt`) is the standard. API keys for machine-to-machine access MUST be
validated through the `api-keys` module before any resource access. Secrets (JWT
secret, DB credentials, third-party keys) MUST be supplied via environment variables
and MUST NOT be committed to source control.

**Rationale**: The platform handles sensitive organizational data, AI-generated
analyses, and billing information. A single unprotected endpoint is a critical
vulnerability.

### IV. Observability Required

Every service operation that touches external systems (database, third-party APIs,
AI providers) MUST emit structured log entries via the Winston logger with at minimum:
`module`, `operation`, `durationMs`, and `status` fields. Errors MUST be logged with
stack traces before being re-thrown or mapped to HTTP exceptions. The healthcheck
endpoint (`/api/v1/health`) MUST cover all critical dependencies (MongoDB, external
services).

**Rationale**: The analysis pipeline (`analyses`, `reports`, `integrations`) involves
async, multi-step processing. Without structured logs, production incidents are
extremely difficult to diagnose.

### V. Simplicity and YAGNI

Features MUST be scoped to their stated requirements. Abstractions (base classes,
generic repositories, factory patterns) are only permitted when three or more
concrete use-cases already exist and the duplication is measurably harmful. NestJS
built-in mechanisms (providers, interceptors, pipes) MUST be preferred over custom
infrastructure. Dependencies MUST be justified — each new package requires a
documented reason in the PR description.

**Rationale**: The codebase already spans 15+ domain modules. Premature abstractions
compound complexity faster than they reduce it.

## Technology Stack

- **Runtime**: Node.js 20.x, TypeScript (strict mode)
- **Framework**: NestJS 10 on Fastify (`@nestjs/platform-fastify`)
- **Database**: MongoDB via Mongoose (`@nestjs/mongoose`)
- **Auth**: JWT (`@nestjs/jwt`) + Passport (`@nestjs/passport`)
- **Validation**: `class-validator` + `class-transformer`
- **Docs**: Swagger (`@nestjs/swagger`), enabled via `SWAGGER_ENABLE` env var
- **Testing**: Jest (`@nestjs/testing`)
- **Logging**: Winston
- **Queue**: Bull (`@nestjs/bull`) for async analysis processing
- **Events**: NestJS EventEmitter (`@nestjs/event-emitter`) for internal events
- **HTTP Client**: Axios for outbound integration calls
- **Containerization**: Docker + docker-compose for local development

Deviations from this stack MUST be approved via the amendment process below and
documented in the affected module's README.

## Development Workflow

- **Branching**: Feature work on `feat/*` branches; merge into `dev` via PR; `dev`
  merges to `master` for releases.
- **PR Requirements**: Every PR MUST include updated Swagger annotations if any DTO
  or route changes, and MUST not reduce test coverage for the affected module.
- **Environment Config**: All configuration MUST go through `@nestjs/config` with
  Joi validation schemas. No `process.env` reads outside of config modules.
- **Error Handling**: Services MUST throw typed NestJS HTTP exceptions
  (`BadRequestException`, `NotFoundException`, etc.) or domain-specific exceptions
  mapped in the common module. Raw `Error` throws are prohibited in controllers and
  services.
- **Async Operations**: Long-running AI analysis tasks MUST be delegated to Bull
  queues. Controllers MUST NOT await unbounded async operations inline.

## Governance

This constitution supersedes all other documented practices. Any conflict between
this document and a feature plan, PR comment, or prior convention is resolved in
favor of this constitution.

**Amendment Procedure**:
1. Open a PR modifying this file with a description of the change and rationale.
2. Bump `CONSTITUTION_VERSION` per semantic versioning rules (MAJOR for principle
   removals or redefinitions, MINOR for additions, PATCH for clarifications).
3. Update `LAST_AMENDED_DATE` to the amendment date.
4. Propagate changes to dependent templates (plan, spec, tasks) in the same PR.
5. PR requires explicit approval from at least one senior team member.

**Compliance Review**: Constitution Check gates in `plan.md` files MUST reference the
active principles by Roman numeral (I–V). Any plan that cannot satisfy a principle
MUST document the violation and justification in the Complexity Tracking table.

**Version Policy**: Follow semantic versioning. Do not amend PATCH without changing
the document in a meaningful way. Governance dates MUST be ISO 8601 (YYYY-MM-DD).

**Version**: 1.0.1 | **Ratified**: 2026-03-04 | **Last Amended**: 2026-03-15
