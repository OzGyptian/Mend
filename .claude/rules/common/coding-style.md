# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## Core Principles

### KISS (Keep It Simple)

- Prefer the simplest solution that actually works
- Avoid premature optimization
- Optimize for clarity over cleverness

### DRY (Don't Repeat Yourself)

- Extract repeated logic into shared functions or utilities
- Avoid copy-paste implementation drift
- Introduce abstractions when repetition is real, not speculative

### YAGNI (You Aren't Gonna Need It)

- Do not build features or abstractions before they are needed
- Avoid speculative generality
- Start simple, then refactor when the pressure is real

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Naming Conventions

- Variables and functions: `camelCase` with descriptive names
- Booleans: prefer `is`, `has`, `should`, or `can` prefixes
- Interfaces, types, and components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Custom hooks: `camelCase` with a `use` prefix

## Code Smells to Avoid

### Deep Nesting

Prefer early returns over nested conditionals once the logic starts stacking.

### Magic Numbers

Use named constants for meaningful thresholds, delays, and limits.

### Long Functions

Split large functions into focused pieces with clear responsibilities.

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
- [ ] No business logic in components/pages — lives in lib/ layer
- [ ] No duplicate algorithm for the same concept — one function, used everywhere
- [ ] No derived value stored separately from its computation
- [ ] Only leaves are stored unconditionally — derived values either aren't stored, OR are in a materialised view, OR have a contract test verifying every leaf writer triggers recompute

## Business Logic Belongs in `lib/` (or equivalent) — Never Inline

**Rule: No business logic in components, pages, or controllers. If it computes something meaningful, it lives in a dedicated library/service layer.**

Components and pages are allowed to call library functions and render the result. They must not contain the formula itself.

### What counts as business logic

- Scoring and ranking formulas
- Qualification thresholds and classification rules
- Any calculation that could change if business rules change
- Any formula that appears in more than one place in the UI

### The rule in practice

```
// WRONG — formula lives in the component, must be updated here AND everywhere else
score = round((triggerScore + proofScore + networkScore) * 10) / 10

// CORRECT — component calls the canonical function from the library layer
score = computeScore({ triggerCount, proofScore, networkScore })
```

**The test:** if the business rules change, you should need to edit exactly one file in the library layer. If you find yourself editing a component or page to change a formula, stop — extract it first.

## DRY — One Algorithm Per Concept

**Rule: The same concept must have exactly one implementation. Two functions that compute the same thing is a bug, not a choice.**

When two parts of the codebase compute the same concept using different code, they will inevitably diverge — silently, with no error, producing wrong results that are very hard to diagnose.

### Warning signs you are about to violate this

- Writing a formula that looks similar to one you've seen elsewhere in the codebase
- Copy-pasting a calculation and tweaking it slightly
- Two functions with similar names and similar return types
- A new feature needs a score/total/derivation that already exists somewhere

### What to do instead

1. **Search first.** Before writing any formula, search for it: grep for the concept name, the output variable name, or the inputs
2. **If it exists, use it.** Import and call the existing function
3. **If it's almost right, generalise it.** Add a parameter rather than duplicating
4. **If the existing function is wrong, fix it.** Don't work around it with a parallel implementation

## Single Source of Truth — No Diverging Copies

**Rule: Derived values must never be stored as independent copies that can drift from their source.**

Storing a computed value in two places (once in the DB, once recomputed at render) guarantees they will eventually diverge — silently, with no error, showing different numbers for the same thing.

### The correct pattern

```
WRONG:
  score written to DB at save time → 3.6
  UI reads stored score → shows 3.6
  Other UI recomputes live → shows 8
  User sees different numbers, no explanation

CORRECT:
  DB stores inputs only (sub-scores, counts, raw data)
  All display points call the same computation function with current inputs
  Historical snapshots are clearly labelled (e.g. "Score at time of assessment: 3.6")
  and never used as current authoritative values
```

### Rules

- **Never display a stored computed value as if it were current.** Either recompute at render time from live inputs, or label it with a timestamp.
- **Store inputs, derive outputs.** DB holds the raw sub-scores; totals are computed at read time.
- **Snapshot/log tables are historical only.** Never use them to drive live UI outside of a history/audit view.

### Leaves and derived values — the stronger form

The above rule, said precisely:

> **For every derived value displayed in the UI, there is exactly one canonical computation. If the value is stored, the system must guarantee the stored value equals the canonical computation of its current leaves. Storing a derived value without an enforced invariant is forbidden.**

**Leaves vs derived:**
- **Leaves** are the irreducible inputs the user (or an external system) gave you: work-history rows, contact rows, raw measurements, raw events. They are what get written.
- **Derived** is anything computed from leaves: sums, scores, classifications, totals, verdicts. They are what get read.

**Only leaves are stored unconditionally. Derived values are stored only if you can enforce the invariant.**

### Three legal ways to store a derived value

1. **Don't store it.** Compute on read. Simplest, always correct. Use this until measured read latency makes it untenable.

2. **Database-enforced (materialised view).** Postgres `MATERIALIZED VIEW` with `REFRESH` triggered on leaf writes. The view definition *is* the canonical formula. The DB guarantees the invariant.

3. **Application-enforced (cache table) with a contract test.** A regular table holds the value; every code path that writes a leaf must call a single canonical `recompute` function; a test enumerates every leaf-writer in the codebase and asserts it calls `recompute`. If you cannot write that test, this option is illegal.

### What is forbidden

- Storing a derived value where the leaf writer doesn't know all the read paths
- "Caching" a computation by writing it once and never invalidating
- Two computation functions for the same concept (one for write-time, one for read-time)
- Reading a stored value labelled as a "score" or "total" without verifying it came from option 2 or 3 above

### Frozen snapshots are a separate category

Audit logs, historical assessments, "score at the moment X happened" — these are legitimately stored and never recomputed. They must be **labelled** at every UI surface as "as of [timestamp]" and never substituted for the current derived value.

### Event-driven architecture is not the default

EDA (event bus, materialised stores updated by consumers) is a fourth implementation of the invariant. It is correct, but heavy. Default to option 1. Escalate to option 2 (materialised views) when you feel the pain. Escalate to EDA only when option 2 also no longer fits.
