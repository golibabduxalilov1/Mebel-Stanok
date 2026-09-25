-- CreateTable
CREATE TABLE "user_branches" (
    "user_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,

    CONSTRAINT "user_branches_pkey" PRIMARY KEY ("user_id","branch_id")
);

-- Migrate existing single-branch assignments before dropping the old column.
-- 'all' and orphaned/unknown branch ids become "no rows" = unrestricted, matching prior semantics.
INSERT INTO "user_branches" ("user_id", "branch_id")
SELECT "id", "branch_id" FROM "users"
WHERE "branch_id" IS NOT NULL
  AND "branch_id" <> 'all'
  AND "branch_id" IN (SELECT "id" FROM "branches");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "branch_id";

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
