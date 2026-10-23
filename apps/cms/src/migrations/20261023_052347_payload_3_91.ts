import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX "sites_header_nav_items_locales_parent_id_idx" ON "sites_header_nav_items_locales" USING btree ("_parent_id");
  CREATE INDEX "sites_footer_columns_links_locales_parent_id_idx" ON "sites_footer_columns_links_locales" USING btree ("_parent_id");
  CREATE INDEX "sites_footer_columns_locales_parent_id_idx" ON "sites_footer_columns_locales" USING btree ("_parent_id");
  CREATE INDEX "sites_locales_parent_id_idx" ON "sites_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_locales_parent_id_idx" ON "pages_blocks_hero_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_text_block_locales_parent_id_idx" ON "pages_blocks_text_block_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_accordion_items_locales_parent_id_idx" ON "pages_blocks_faq_accordion_items_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_accordion_locales_parent_id_idx" ON "pages_blocks_faq_accordion_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_features_locales_parent_id_idx" ON "pages_blocks_feature_grid_features_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_locales_parent_id_idx" ON "pages_blocks_feature_grid_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_form_embed_locales_parent_id_idx" ON "pages_blocks_form_embed_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_signup_form_locales_parent_id_idx" ON "pages_blocks_signup_form_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_leader_spotlight_locales_parent_id_idx" ON "pages_blocks_leader_spotlight_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_donation_tiers_locales_parent_id_idx" ON "pages_blocks_donation_tiers_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_commitments_grid_items_locales_parent_id_idx" ON "pages_blocks_commitments_grid_items_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_commitments_grid_locales_parent_id_idx" ON "pages_blocks_commitments_grid_locales" USING btree ("_parent_id");
  CREATE INDEX "pages_locales_parent_id_idx" ON "pages_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_locales_parent_id_idx" ON "_pages_v_blocks_hero_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_text_block_locales_parent_id_idx" ON "_pages_v_blocks_text_block_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_accordion_items_locales_parent_id_idx" ON "_pages_v_blocks_faq_accordion_items_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_accordion_locales_parent_id_idx" ON "_pages_v_blocks_faq_accordion_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_features_locales_parent_id_idx" ON "_pages_v_blocks_feature_grid_features_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_locales_parent_id_idx" ON "_pages_v_blocks_feature_grid_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_form_embed_locales_parent_id_idx" ON "_pages_v_blocks_form_embed_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_signup_form_locales_parent_id_idx" ON "_pages_v_blocks_signup_form_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_leader_spotlight_locales_parent_id_idx" ON "_pages_v_blocks_leader_spotlight_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_donation_tiers_locales_parent_id_idx" ON "_pages_v_blocks_donation_tiers_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_commitments_grid_items_locales_parent_id_idx" ON "_pages_v_blocks_commitments_grid_items_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_commitments_grid_locales_parent_id_idx" ON "_pages_v_blocks_commitments_grid_locales" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_locales_parent_id_idx" ON "_pages_v_locales" USING btree ("_parent_id");
  CREATE INDEX "media_locales_parent_id_idx" ON "media_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_locales_parent_id_idx" ON "forms_blocks_checkbox_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_country_locales_parent_id_idx" ON "forms_blocks_country_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_email_locales_parent_id_idx" ON "forms_blocks_email_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_message_locales_parent_id_idx" ON "forms_blocks_message_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_number_locales_parent_id_idx" ON "forms_blocks_number_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_options_locales_parent_id_idx" ON "forms_blocks_select_options_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_locales_parent_id_idx" ON "forms_blocks_select_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_state_locales_parent_id_idx" ON "forms_blocks_state_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_text_locales_parent_id_idx" ON "forms_blocks_text_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_textarea_locales_parent_id_idx" ON "forms_blocks_textarea_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_emails_locales_parent_id_idx" ON "forms_emails_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_locales_parent_id_idx" ON "forms_locales" USING btree ("_parent_id");
  CREATE INDEX "site_urls_locales_parent_id_idx" ON "site_urls_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "sites_header_nav_items_locales_parent_id_idx";
  DROP INDEX "sites_footer_columns_links_locales_parent_id_idx";
  DROP INDEX "sites_footer_columns_locales_parent_id_idx";
  DROP INDEX "sites_locales_parent_id_idx";
  DROP INDEX "pages_blocks_hero_locales_parent_id_idx";
  DROP INDEX "pages_blocks_text_block_locales_parent_id_idx";
  DROP INDEX "pages_blocks_faq_accordion_items_locales_parent_id_idx";
  DROP INDEX "pages_blocks_faq_accordion_locales_parent_id_idx";
  DROP INDEX "pages_blocks_feature_grid_features_locales_parent_id_idx";
  DROP INDEX "pages_blocks_feature_grid_locales_parent_id_idx";
  DROP INDEX "pages_blocks_form_embed_locales_parent_id_idx";
  DROP INDEX "pages_blocks_signup_form_locales_parent_id_idx";
  DROP INDEX "pages_blocks_leader_spotlight_locales_parent_id_idx";
  DROP INDEX "pages_blocks_donation_tiers_locales_parent_id_idx";
  DROP INDEX "pages_blocks_commitments_grid_items_locales_parent_id_idx";
  DROP INDEX "pages_blocks_commitments_grid_locales_parent_id_idx";
  DROP INDEX "pages_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_hero_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_text_block_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_faq_accordion_items_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_faq_accordion_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_feature_grid_features_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_feature_grid_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_form_embed_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_signup_form_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_leader_spotlight_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_donation_tiers_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_commitments_grid_items_locales_parent_id_idx";
  DROP INDEX "_pages_v_blocks_commitments_grid_locales_parent_id_idx";
  DROP INDEX "_pages_v_locales_parent_id_idx";
  DROP INDEX "media_locales_parent_id_idx";
  DROP INDEX "forms_blocks_checkbox_locales_parent_id_idx";
  DROP INDEX "forms_blocks_country_locales_parent_id_idx";
  DROP INDEX "forms_blocks_email_locales_parent_id_idx";
  DROP INDEX "forms_blocks_message_locales_parent_id_idx";
  DROP INDEX "forms_blocks_number_locales_parent_id_idx";
  DROP INDEX "forms_blocks_select_options_locales_parent_id_idx";
  DROP INDEX "forms_blocks_select_locales_parent_id_idx";
  DROP INDEX "forms_blocks_state_locales_parent_id_idx";
  DROP INDEX "forms_blocks_text_locales_parent_id_idx";
  DROP INDEX "forms_blocks_textarea_locales_parent_id_idx";
  DROP INDEX "forms_emails_locales_parent_id_idx";
  DROP INDEX "forms_locales_parent_id_idx";
  DROP INDEX "site_urls_locales_parent_id_idx";`)
}
