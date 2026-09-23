-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('active', 'maintenance', 'repair', 'retired');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('image', 'video', 'pdf', 'document', 'archive', 'link', 'other');

-- CreateEnum
CREATE TYPE "ToirTaskType" AS ENUM ('routine', 'diagnostic', 'ppr', 'emergency');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('routine', 'repair', 'inspection', 'diagnostic', 'ppr', 'emergency');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('create', 'update', 'delete', 'transfer', 'other');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('machine', 'branch', 'part', 'schedule', 'log', 'transfer', 'user', 'role', 'other');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "contact_person" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "inventory_number" TEXT,
    "category" TEXT NOT NULL,
    "branch_id" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'active',
    "purchase_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchase_date" TIMESTAMPTZ,
    "installation_date" TIMESTAMPTZ,
    "last_maintenance_date" TIMESTAMPTZ,
    "next_maintenance_date" TIMESTAMPTZ,
    "useful_life_years" INTEGER,
    "description" TEXT,
    "image_url" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_attachments" (
    "id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumbnail_key" TEXT,
    "size" INTEGER,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT,
    "description" TEXT,
    "is_main_image" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "machine_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spare_parts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "min_quantity" DECIMAL(14,3),
    "unit_price" DECIMAL(14,2),
    "unit" TEXT,
    "image_url" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "branch_id" TEXT,
    "machine_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spare_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "last_performed" TIMESTAMPTZ,
    "next_due" TIMESTAMPTZ,
    "task_type" "ToirTaskType",
    "description" TEXT,
    "priority" "Priority",
    "assigned_technician" TEXT,
    "labor_cost" DECIMAL(14,2),
    "estimated_hours" DECIMAL(6,2),
    "image_url" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedule_parts" (
    "schedule_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "maintenance_schedule_parts_pkey" PRIMARY KEY ("schedule_id","part_id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "from_branch_id" TEXT,
    "to_branch_id" TEXT NOT NULL,
    "date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "technician_name" TEXT,
    "type" "LogType" NOT NULL,
    "task_type" "ToirTaskType",
    "notes" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "performed_by" TEXT,
    "schedule_id" TEXT,
    "next_maintenance_date" TIMESTAMPTZ,
    "image_url" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_log_parts" (
    "log_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "maintenance_log_parts_pkey" PRIMARY KEY ("log_id","part_id")
);

-- CreateTable
CREATE TABLE "activity_history" (
    "id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT,
    "entity_name" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "user_email" TEXT,

    CONSTRAINT "activity_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "permissions" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" TEXT,
    "branch_id" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "last_login" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machines_serial_number_key" ON "machines"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_attachments" ADD CONSTRAINT "machine_attachments_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedule_parts" ADD CONSTRAINT "maintenance_schedule_parts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedule_parts" ADD CONSTRAINT "maintenance_schedule_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_branch_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_branch_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_log_parts" ADD CONSTRAINT "maintenance_log_parts_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "maintenance_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_log_parts" ADD CONSTRAINT "maintenance_log_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Non-negative / positive value invariants (defense in depth alongside zod validation)
ALTER TABLE "machines" ADD CONSTRAINT "machines_purchase_price_nonneg" CHECK ("purchase_price" >= 0);
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_quantity_nonneg" CHECK ("quantity" >= 0);
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_min_quantity_nonneg" CHECK ("min_quantity" IS NULL OR "min_quantity" >= 0);
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_unit_price_nonneg" CHECK ("unit_price" IS NULL OR "unit_price" >= 0);
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_cost_nonneg" CHECK ("cost" >= 0);
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_interval_positive" CHECK ("interval_days" > 0);
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_labor_cost_nonneg" CHECK ("labor_cost" IS NULL OR "labor_cost" >= 0);
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_estimated_hours_nonneg" CHECK ("estimated_hours" IS NULL OR "estimated_hours" >= 0);
ALTER TABLE "maintenance_schedule_parts" ADD CONSTRAINT "maintenance_schedule_parts_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "maintenance_log_parts" ADD CONSTRAINT "maintenance_log_parts_quantity_positive" CHECK ("quantity" > 0);
