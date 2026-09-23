# Security Specification for Machine Inventory System

## 1. Data Invariants
- A **Machine** must have a unique `serialNumber`.
- Access to **MaintenanceLog** is restricted to authenticated users.
- Only the creator or an admin can delete a **Machine**.
- `status` must be one of the predefined values.
- `updatedAt` and `createdAt` (if added) must be server-controlled.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

### Machine Collection
1. **Identity Spoofing**: Create a machine with `createdBy` or `ownerId` set to another user's ID.
2. **State Shortcutting**: Update machine status to `retired` without proper authorization or bypassing transition logic.
3. **Resource Poisoning**: Inject a 1MB string into the `description` or `model` field.
4. **ID Hijacking**: Attempt to create/update a document with an extremely long or malicious ID (e.g., `../poison`).
5. **Unauthorized Write**: Unauthenticated user attempting to create a machine.
6. **Schema Break**: Create a machine missing the `status` field.
7. **Type Incompatibility**: Set `lastMaintenanceDate` to a boolean instead of a timestamp.

### MaintenanceLog Collection
8. **Orphaned Log**: Create a maintenance log for a non-existent machine ID.
9. **Log Forgery**: Modification of a maintenance log by someone other than the original technician or an admin.
10. **Cost Manipulation**: Log a negative maintenance cost.
11. **Bulk Scraping**: Attempting to list all logs without being authenticated.
12. **System Field Injection**: Attempting to set or modify `updatedAt` manually rather than using `request.time`.

## 3. Test Runner Strategy
- All "Dirty Dozen" payloads must return `PERMISSION_DENIED`.
- Authorized users can read all machines.
- Authorized users can create machines and logs.
- Owners/Admins can update machine details.
