-- AlterTable
ALTER TABLE "maintenance_logs" ADD COLUMN     "labor_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "parts_cost" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "maintenance_log_parts" ADD COLUMN     "unit_price" DECIMAL(14,2);

-- Backfill. Historical part prices were never stored, so today's price is the best available snapshot.
UPDATE "maintenance_log_parts" AS lp
SET "unit_price" = COALESCE(sp."unit_price", 0)
FROM "spare_parts" AS sp
WHERE sp."id" = lp."part_id";

UPDATE "maintenance_logs" AS l
SET "parts_cost" = s."total"
FROM (
  SELECT "log_id", ROUND(SUM("quantity" * COALESCE("unit_price", 0)), 2) AS "total"
  FROM "maintenance_log_parts"
  GROUP BY "log_id"
) AS s
WHERE s."log_id" = l."id";

-- The old form's cost field was "Стоимость работ", but when it was left empty the parts sum was saved
-- as cost instead. Such rows (cost equal to the parts sum) had no labor; otherwise cost was the labor.
UPDATE "maintenance_logs"
SET "labor_cost" = CASE WHEN "parts_cost" > 0 AND ABS("cost" - "parts_cost") < 0.01 THEN 0 ELSE "cost" END;

UPDATE "maintenance_logs" SET "cost" = "labor_cost" + "parts_cost";
