-- Remove 'link' from the AttachmentType enum (no rows use it).
-- Postgres has no direct DROP VALUE for enums, so the type is recreated.
ALTER TYPE "AttachmentType" RENAME TO "AttachmentType_old";

CREATE TYPE "AttachmentType" AS ENUM ('image', 'video', 'pdf', 'document', 'archive', 'other');

ALTER TABLE "machine_attachments"
  ALTER COLUMN "type" TYPE "AttachmentType"
  USING ("type"::text::"AttachmentType");

DROP TYPE "AttachmentType_old";
