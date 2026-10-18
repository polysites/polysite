import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_petition_dedupe" AS ENUM('none', 'email');
  ALTER TABLE "forms" ADD COLUMN "petition_dedupe" "enum_forms_petition_dedupe" DEFAULT 'none';
  ALTER TABLE "forms" ADD COLUMN "petition_show_count" boolean DEFAULT false;
  ALTER TABLE "forms" ADD COLUMN "petition_count_offset" numeric;
  ALTER TABLE "forms" ADD COLUMN "petition_goal" numeric;
  ALTER TABLE "form_submissions" ADD COLUMN "dedupe_key" varchar;
  CREATE UNIQUE INDEX "form_dedupeKey_idx" ON "form_submissions" USING btree ("form_id","dedupe_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "form_dedupeKey_idx";
  ALTER TABLE "forms" DROP COLUMN "petition_dedupe";
  ALTER TABLE "forms" DROP COLUMN "petition_show_count";
  ALTER TABLE "forms" DROP COLUMN "petition_count_offset";
  ALTER TABLE "forms" DROP COLUMN "petition_goal";
  ALTER TABLE "form_submissions" DROP COLUMN "dedupe_key";
  DROP TYPE "public"."enum_forms_petition_dedupe";`)
}
