# Allo Health - Engineering Take-Home Exercise

This repository contains the end-to-end implementation for the Allo Health inventory and order-fulfillment platform exercise. It handles concurrent inventory reservations, eliminating edge cases leading to overselling or depleted availability from abandoned carts.

## Architecture & Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (hosted on Supabase)
- **ORM**: Prisma (using pessimistic database-level locking mechanisms)
- **UI**: Tailwind CSS + custom functional components

## Concurrency Guarantee (The Core Problem)
When multiple users reach checkout for the last unit simultaneously, exactly one should succeed (getting the reservation) and the rest should fail gracefully (HTTP 409). 

**My approach:** 
I used a **pessimistic lock at the database level** (`SELECT ... FOR UPDATE` via Prisma `$queryRaw`) inside a `$transaction`. 
When a reservation request starts, the specific `Stock` row is locked. The system verifies `totalUnits - reservedUnits >= quantity`. If valid, it increments `reservedUnits` and creates a `Reservation` row. The lock guarantees strict serialization of these concurrent requests, completely preventing race conditions without needing an external distributed lock manager.

## Background Expiry Mechanism
Reservations are kept in a `PENDING` state with an `expiresAt` timestamp set to 10 minutes in the future.
If a reservation expires:
1. **Frontend**: The countdown timer shows "Expired" and disables the Confirm button.
2. **Backend Engine**: A cron endpoint (`GET /api/cron/release-expired`) automatically polls for `PENDING` reservations where `expiresAt < now()`. It uses the same transaction and lock mechanism to safely decrement `reservedUnits` on the stock row, and shifts the status to `RELEASED`.

## Idempotency (Bonus)
The application includes idempotency for the reservation creation endpoint.
If a client retries a request with the same `Idempotency-Key` header (or one generated at the first initial request), it checks the `Reservation` table (via a unique constraint) and returns the existing resource without duplicating the deduction of available units.

## Local Setup

### 1. Environment Variables
\`\`\`env
# Connect directly to Postgres
DATABASE_URL="postgresql://postgres:AlloInventory2026!@db.bjqurdeertwcetitfido.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:AlloInventory2026!@db.bjqurdeertwcetitfido.supabase.co:5432/postgres"
\`\`\`

### 2. Install & Initialise
\`\`\`bash
npm install
npx prisma generate
npx prisma db push
\`\`\`

### 3. Seed the Database
Seed the mock Warehouses, Products, and Stock levels:
\`\`\`bash
npx tsx prisma/seed.ts
\`\`\`

### 4. Run the Dev Server
\`\`\`bash
npm run dev
\`\`\`

## Trade-offs and "Next Steps"
- **Pessimistic vs Optimistic Locking**: A pessimistic DB lock works fantastically for solving race conditions on low-contention hotspots, but an optimistic lock (checking a `version` integer) might offer slightly better pure read/write concurrency at extreme global scale. However, pessimistic guarantees zero retries for failures.
- **Background Jobs**: Next.js limits background execution inherently natively. I designed the expiry cleanup to rely on an external scheduler pinging a Vercel Edge Route. In a scaled system, I would use **SQS/Redis queues (BullMQ)** or **Upstash QStash** to schedule a deferred webhook task exactly 10 minutes out, rather than aggressively polling. 
- **Stock Calculations**: Currently `availableStock` is inferred dynamically (`total_units - reserved_units`). For a read-heavy e-commerce listing, it might make sense to cache the calculated available stock limit in Redis, invalidating or emitting events upon stock mutations.
