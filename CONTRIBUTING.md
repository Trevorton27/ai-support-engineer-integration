# Contributing

Thanks for your interest in contributing. This is primarily a portfolio project, but PRs that fix bugs, improve tests, or add clearly scoped features are welcome.

---

## Getting Started

1. Fork the repo and create a branch from `main`
2. Follow the [local setup instructions](README.md#local-setup) to get both apps running
3. Make your changes
4. Run the full test suite and confirm it passes before opening a PR

---

## Development Workflow

### Install dependencies

```bash
pnpm install
```

### Run both apps

```bash
pnpm dev
```

### Run tests

```bash
# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright — copilot-service must be running on :3001)
pnpm test:e2e

# Type check
pnpm --dir apps/crm exec tsc --noEmit
pnpm --dir apps/copilot-service exec tsc --noEmit
```

### Database

Both apps share a single database. Run migrations from the copilot-service directory:

```bash
pnpm --dir apps/copilot-service exec prisma migrate dev
```

---

## Code Style

- TypeScript — no `any` unless genuinely unavoidable
- Tailwind for styling; no inline `style=` except for dynamic values that Tailwind can't express
- Zod for all external data validation (API inputs, LLM outputs)
- New API routes follow the async job pattern in `asyncExecution.ts`
- New LLM calls go through `aiProvider.ts` and must call `redactTicketSnapshot()` before sending data to OpenAI

---

## Pull Request Guidelines

- Keep PRs focused — one logical change per PR
- Include tests for new behavior: unit tests in `src/lib/__tests__/`, E2E in `e2e/`
- Update `docs/api-contract.md` if you add or change API routes
- Do not commit `.env` files, secrets, or generated build artifacts

---

## Reporting Issues

Open an issue on GitHub describing:
- What you expected to happen
- What actually happened
- Steps to reproduce
- App and Node.js version
