import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_locales" ADD COLUMN "translated_slug" varchar;
  ALTER TABLE "_pages_v_locales" ADD COLUMN "version_translated_slug" varchar;
  ALTER TABLE "site_urls_locales" ADD COLUMN "localized_path" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_locales" DROP COLUMN "translated_slug";
  ALTER TABLE "_pages_v_locales" DROP COLUMN "version_translated_slug";
  ALTER TABLE "site_urls_locales" DROP COLUMN "localized_path";`)
}
