# Phase 1: Foundation - Research

**Researched:** 2026-01-21
**Domain:** Prisma schema changes, token generation, database migration
**Confidence:** HIGH

## Summary

Phase 1 adds `statusToken` fields to the existing `Member` and `Group` models in Prisma, with automatic token generation on record creation. The simpler approach of adding fields directly to existing models (rather than a separate ShareToken table) was chosen per project decisions, as tokens are static and never regenerated.

The implementation requires three components: (1) Prisma schema changes adding optional `statusToken` fields with unique constraints, (2) a token generation utility using Node.js `crypto.randomBytes(24).toString('base64url')` for 32-character URL-safe tokens, and (3) Prisma Client Extensions to auto-populate tokens on create operations.

Backfilling existing records requires a migration script similar to the existing `prisma/migrate-sponsors.ts` pattern.

**Primary recommendation:** Use Prisma Client Extensions (query component) to auto-generate tokens on model creation, since Prisma middleware is deprecated/removed in v6.14.0+ and custom `@default` functions are not supported.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | Built-in | Token generation | Already available, cryptographically secure, no dependencies |
| Prisma | 7.2 (existing) | Schema changes, extensions | Already in use, supports Client Extensions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.21 (existing) | Run TypeScript migration scripts | Backfill existing records |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Application-level token gen | `dbgenerated("(hex(randomblob(24)))")` | SQLite hex encoding produces 48 chars, not URL-safe; base64url not supported natively |
| Prisma Extensions | Prisma middleware | Middleware deprecated in v4.16.0, removed in v6.14.0 |
| `crypto.randomBytes` | nanoid | Adds dependency, no security benefit |
| 24 bytes (base64url) | 16 bytes | 24 bytes provides 192 bits entropy vs 128 bits; negligible size difference |

**Installation:**
```bash
# No new dependencies required - uses built-in Node.js crypto
```

## Architecture Patterns

### Recommended Schema Change

Add `statusToken` directly to Member and Group models:

```prisma
// In Member model
statusToken   String?   @unique

// In Group model
statusToken   String?   @unique
```

**Why optional (`String?`):**
- Allows schema migration without breaking existing records
- Backfill script generates tokens for existing records
- Unique constraint still enforced when value present

### Pattern 1: Token Generation Utility

**What:** Utility function to generate secure tokens
**When to use:** Called by Prisma extension on create, and by backfill script
**Example:**
```typescript
// lib/tokens.ts
import { randomBytes } from 'crypto'

/**
 * Generates a 32-character URL-safe token with 192 bits entropy
 * Uses base64url encoding (no +, /, or = characters)
 */
export function generateStatusToken(): string {
  // 24 bytes = 192 bits = 32 base64url characters
  return randomBytes(24).toString('base64url')
}
// Example output: "Kj7mN2xP9qR4sT1vW3yZ5aB8cD0eF6gH"
```

**Source:** [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)

### Pattern 2: Prisma Client Extension for Auto-Generation

**What:** Extend PrismaClient to auto-populate statusToken on create
**When to use:** Replace middleware pattern (deprecated in Prisma 6.14.0+)
**Example:**
```typescript
// lib/db.ts - Extended version
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { generateStatusToken } from './tokens'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
}, {
  timestampFormat: 'unixepoch-ms'
})

const basePrisma = new PrismaClient({ adapter })

export const prisma = basePrisma.$extends({
  query: {
    member: {
      async create({ args, query }) {
        // Only generate token for members WITHOUT a group (per TOKEN-02)
        if (!args.data.groupId && !args.data.statusToken) {
          args.data.statusToken = generateStatusToken()
        }
        return query(args)
      },
    },
    group: {
      async create({ args, query }) {
        // Always generate token for groups (per TOKEN-01)
        if (!args.data.statusToken) {
          args.data.statusToken = generateStatusToken()
        }
        return query(args)
      },
    },
  },
})
```

**Source:** [Prisma Client Extensions Query Component](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query)

### Pattern 3: Backfill Migration Script

**What:** Generate tokens for existing records
**When to use:** After schema change, before using tokens
**Example:**
```typescript
// prisma/generate-status-tokens.ts
import { PrismaClient } from '@prisma/client'
import { generateStatusToken } from '../lib/tokens'

const prisma = new PrismaClient()

async function main() {
  console.log('Generating status tokens for existing records...')

  // Generate tokens for all groups
  const groups = await prisma.group.findMany({
    where: { statusToken: null }
  })

  for (const group of groups) {
    await prisma.group.update({
      where: { id: group.id },
      data: { statusToken: generateStatusToken() }
    })
  }
  console.log(`Generated tokens for ${groups.length} groups`)

  // Generate tokens for members WITHOUT a group
  const members = await prisma.member.findMany({
    where: {
      statusToken: null,
      groupId: null  // Only ungrouped members get tokens
    }
  })

  for (const member of members) {
    await prisma.member.update({
      where: { id: member.id },
      data: { statusToken: generateStatusToken() }
    })
  }
  console.log(`Generated tokens for ${members.length} ungrouped members`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Source:** Pattern follows existing `prisma/migrate-sponsors.ts`

### Anti-Patterns to Avoid
- **Using CUID as token:** CUIDs contain timestamps and are enumerable. Use dedicated cryptographic random bytes.
- **Storing token in separate table:** Adds complexity without benefit for static tokens.
- **Using Prisma middleware:** Deprecated since v4.16.0, removed in v6.14.0.
- **Using `@default(cuid())` for tokens:** CUIDs are not secure for capability URLs.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random token generation | Math.random-based strings | `crypto.randomBytes` | Math.random is not cryptographically secure |
| URL-safe encoding | Custom character replacement | `toString('base64url')` | Built-in, standard encoding |
| Auto-populate on create | Manual calls in every create location | Prisma Client Extensions | Centralized, type-safe, cannot be forgotten |

**Key insight:** Token security depends on entropy source. Node.js `crypto.randomBytes` uses OS-level cryptographic RNG.

## Common Pitfalls

### Pitfall 1: Using CUID as Public Token
**What goes wrong:** Using existing CUID IDs or `@default(cuid())` for public tokens creates guessable, enumerable tokens.
**Why it happens:** Convenience - reusing existing patterns without understanding security implications.
**How to avoid:** Always use `crypto.randomBytes` for public capability URLs.
**Warning signs:** Token field uses `@default(cuid())` in schema.

### Pitfall 2: Forgetting Extension for Nested Creates
**What goes wrong:** Prisma extensions don't automatically apply to nested operations like `create` within `createMany` or nested writes.
**Why it happens:** Extensions intercept top-level operations only.
**How to avoid:** For this use case, simple `create` is sufficient. If `createMany` is needed, generate tokens in application code before passing to Prisma.
**Warning signs:** Records created via nested operations lack tokens.

### Pitfall 3: Race Condition on Token Uniqueness
**What goes wrong:** Two concurrent creates could theoretically generate the same token.
**Why it happens:** Extremely unlikely with 192 bits entropy, but unique constraint provides safety net.
**How to avoid:** Schema has `@unique` constraint; Prisma will error on collision (retry with new token if needed).
**Warning signs:** Unique constraint violation errors in production.

### Pitfall 4: Overwriting Existing Token on Update
**What goes wrong:** Extension code that runs on update operations could regenerate tokens.
**Why it happens:** Using `$allOperations` instead of specific `create` operation.
**How to avoid:** Extension only intercepts `create`, not `update`. Token field is never touched after initial creation.
**Warning signs:** Tokens change after record updates.

## Code Examples

Verified patterns from official sources:

### Token Generation Function
```typescript
// lib/tokens.ts
// Source: Node.js Crypto Documentation
import { randomBytes } from 'crypto'

export function generateStatusToken(): string {
  return randomBytes(24).toString('base64url')
}
```

### Schema Addition
```prisma
// prisma/schema.prisma
// Source: Prisma Schema Reference

model Member {
  // ... existing fields ...
  statusToken   String?   @unique  // For members without group
  // ... rest of model ...
}

model Group {
  // ... existing fields ...
  statusToken   String?   @unique  // All groups get tokens
  // ... rest of model ...
}
```

### Extended Prisma Client
```typescript
// lib/db.ts
// Source: Prisma Client Extensions documentation

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { generateStatusToken } from './tokens'

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedPrisma> | undefined
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
}, {
  timestampFormat: 'unixepoch-ms'
})

function createExtendedPrisma() {
  const basePrisma = new PrismaClient({ adapter })

  return basePrisma.$extends({
    query: {
      member: {
        async create({ args, query }) {
          // TOKEN-02: Members without a group get a statusToken
          if (!args.data.groupId && !args.data.statusToken) {
            args.data.statusToken = generateStatusToken()
          }
          return query(args)
        },
      },
      group: {
        async create({ args, query }) {
          // TOKEN-01: All groups get a statusToken
          if (!args.data.statusToken) {
            args.data.statusToken = generateStatusToken()
          }
          return query(args)
        },
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createExtendedPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma middleware | Prisma Client Extensions | v4.16.0 (deprecated), v6.14.0 (removed) | Must use `$extends` for query interception |
| CUID v1 | CUID v2 or crypto.randomBytes | 2022 | CUID v1 deprecated due to timestamp exposure |
| `@default(cuid())` for tokens | Application-level generation | N/A (security best practice) | CUID is for database uniqueness, not security |

**Deprecated/outdated:**
- Prisma middleware: Removed in v6.14.0 - use Client Extensions instead
- CUID v1: Deprecated, contains enumerable timestamps

## Open Questions

Things that couldn't be fully resolved:

1. **Member group assignment changes**
   - What we know: TOKEN-02 says members without a group get tokens
   - What's unclear: What happens if a member is later assigned to a group (or removed from one)?
   - Recommendation: Token remains unchanged per TOKEN-03 (static tokens). The business logic for which token to use (member's or group's) is Phase 2 API concern.

2. **Concurrent create collision handling**
   - What we know: 192 bits makes collision virtually impossible
   - What's unclear: Should extension retry on unique constraint violation?
   - Recommendation: Let Prisma throw; collision is astronomically unlikely. If it ever happens, API error is acceptable for this ultra-rare case.

## Sources

### Primary (HIGH confidence)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback) - Token generation
- [Prisma Client Extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions) - Extension pattern
- [Prisma Query Component](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) - Query interception
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) - `@unique` constraint

### Secondary (MEDIUM confidence)
- [Prisma Middleware Deprecation](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware) - Confirms middleware removed in v6.14.0
- [SQLite Core Functions](https://sqlite.org/lang_corefunc.html) - `hex(randomblob())` limitation (hex encoding, not base64url)

### Verified in Codebase
- `/home/moetiker/checkouts/donorflow/prisma/schema.prisma` - Current Member and Group models
- `/home/moetiker/checkouts/donorflow/lib/db.ts` - Current Prisma client setup with adapter
- `/home/moetiker/checkouts/donorflow/prisma/migrate-sponsors.ts` - Migration script pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses built-in Node.js crypto, verified Prisma extension pattern
- Architecture: HIGH - Follows existing codebase patterns, official Prisma docs
- Pitfalls: HIGH - Well-documented security concerns for capability URLs

**Research date:** 2026-01-21
**Valid until:** 60 days (Prisma 7.x stable, crypto API stable)
