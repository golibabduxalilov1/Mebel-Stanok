# Migration report: Firestore → PostgreSQL backend

**Status: done.** `backend/` is the PostgreSQL/Express/Prisma API, and `frontend/`
has been fully rewired to use it — Firebase (Auth, Firestore, Storage) is gone from
the codebase entirely. This report is now a record of how the old Firestore
behavior maps onto the new stack, for anyone picking up this code later.

## 1. Firestore behavior → what replaced it

| Old Firestore / client-side behavior | New mechanism |
|---|---|
| `onSnapshot(collection(db, 'machines'), cb)` live listeners | Socket.io (`backend/src/lib/socket.ts`, `frontend/src/lib/socket.ts`). `frontend/src/lib/collectionCache.ts` seeds an in-memory cache with one REST fetch, then patches it on `machine:created`/`updated`/`deleted` (and `branch:*`, `activity:*`, `user:*`, `role:*`, `sparePart:*`, `schedule:*`, `log:*`, `transfer:created`, `attachment:*`) and hands `subscribeToMachines`/`subscribeToBranches`/`subscribeToActivityLogs`/`subscribeUsers`/`subscribeRoles` callers the **full current array** each time — same contract the old `onSnapshot` callbacks had, so `App.tsx`'s `setMachines`/`setBranches`/etc. call sites didn't need to change. |
| Firestore offline cache (`persistentLocalCache`) | Not replicated — the app is online-only now. Would need a service-worker + IndexedDB write-queue to add back. |
| Client-side-only permission checks (`canAccessTab`/`canPerformAction`) | Same functions, still in `frontend/src/services/userService.ts` (pure UI config, unchanged), but now also enforced server-side by `backend/src/middleware/permissions.ts` on every write route. The frontend copies are UI hints only — the real gate is the API. |
| Plaintext passwords in Firestore user docs, compared client-side, cached in `localStorage` | `bcrypt`-hashed `password_hash`, never returned by any endpoint. Login is `POST /api/v1/auth/login`; the access token lives in a module variable in `frontend/src/lib/apiClient.ts` (never localStorage), refreshed via an httpOnly cookie (`POST /api/v1/auth/refresh`). |
| `firestore.rules` (`allow read, write: if true`) | File deleted. Every route requires a JWT; every write route requires the caller's role to grant the specific `tabId.rowId` permission. |
| `machineService.getDiffDetails()`/`logActivity()` writing `activity_history` from the client | `backend/src/utils/activityLog.ts`, run inside the same DB transaction as the mutation it describes. There is no route for a client to write `activity_history` directly — `App.tsx`'s one direct `logActivity()` call (in the decommission flow) was removed; the same info is already captured by the automatic `description`-field diff on that same `updateMachine` call. |
| Read-then-write stock adjustment in `addLog`/`updateLog`/`deleteLog` | Atomic `UPDATE spare_parts SET quantity = GREATEST(quantity + delta, 0)` inside the same Postgres transaction as the log write (`backend/src/utils/partsStock.ts`). |
| Two separate Firestore writes in `transferMachine` | One transaction: insert into `transfers` + update `machines.branch_id` (`POST /api/v1/transfers`). |
| `machine.attachments` as a plain array field on the Machine doc, backed by Firebase Storage + an IndexedDB cache (`blobStorageService.ts`) to dodge Firestore's 1MB limit | Real `machine_attachments` table with its own upload/download/thumbnail/metadata endpoints. `frontend/src/components/MachineFilesModal.tsx` uploads straight to the backend; `machineService.resolveAttachmentUrl()` fetches the authenticated blob and caches an object URL (same pattern `blobStorageService.resolveUrl` used, just backend-sourced). External "link" attachments (YouTube, Яндекс.Диск, etc. with no uploaded file) are a small addition beyond the original spec: `POST /machines/:id/attachments/link`. |
| One-click "log in as this user" (no password) and "copy this user's plaintext password" in the Users tab | Both removed (user decision) — passwords are bcrypt-hashed server-side and can't be read back at all; switching identity now means logging out and back in with real credentials. |

## 2. What's deliberately different from the original app

- **Folder "main photo" no longer syncs to `machine.imageUrl`.** The original synced the "file folder" (attachments) main image into the separate `machine.imageUrl`/`imageUrls` base64 fields used by the Edit Machine form's photo picker. Attachment URLs are now authenticated blob URLs (ephemeral per session), which can't be stored as a stable `imageUrl` string, so that cross-sync was dropped. The two photo mechanisms are independent now: `MultiPhotoPicker` in the machine edit form (base64, unchanged) and the attachments folder (`isMainImage` flag, its own thing).
- **`imageUrl`/`imageUrls` (base64 photo fields)** were added to `MaintenanceLog`, `SparePart`, and `MaintenanceSchedule` in the Postgres schema, and `imageUrls` (plural) to `Machine` — the original backend build only had `Machine.imageUrl` (singular), which would have silently dropped these fields (they're unrelated to Firebase; `MultiPhotoPicker` embeds compressed base64 strings directly, same as before).
- **Decimal fields serialize as numbers, not strings.** Prisma's `Decimal` type stringifies itself by default; `backend/src/middleware/serializeDecimals.ts` walks every JSON response and converts it back to a real number so `purchasePrice`/`quantity`/`cost`/etc. behave the same as the old Firestore numeric fields.
- **`GET /users` and `GET /roles`** are readable by any authenticated user (not just admins) — the original Firestore rules exposed both collections to everyone, and non-admin users need them for technician-name pickers and tab counts. Mutations (create/update/delete, password changes) stay admin-only.

## 3. Running it

See `backend/README.md` for backend setup (env, migrations, seed, run). Frontend:
`cd frontend && npm install && npm run dev`. Both read their backend/frontend URLs
from `.env` (`VITE_API_BASE_URL`, `VITE_SOCKET_URL` on the frontend side).
