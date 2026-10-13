import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'fr', 'es', 'de', 'it', 'pt', 'pt-BR', 'nl', 'sv', 'da', 'nb', 'fi', 'pl', 'cs', 'sk', 'sl', 'hr', 'sr', 'hu', 'ro', 'bg', 'el', 'et', 'lv', 'lt', 'ca', 'cy', 'ga', 'tr', 'ru', 'uk', 'ar', 'he', 'fa', 'ur', 'hi', 'bn', 'ta', 'id', 'ms', 'vi', 'th', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'sw', 'af');
  CREATE TYPE "public"."enum_sites_social_links_platform" AS ENUM('instagram', 'facebook', 'youtube', 'x', 'tiktok', 'linkedin', 'other');
  CREATE TYPE "public"."enum_pages_review_state" AS ENUM('none', 'in-review', 'changes-requested');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_review_state" AS ENUM('none', 'in-review', 'changes-requested');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en', 'fr', 'es', 'de', 'it', 'pt', 'pt-BR', 'nl', 'sv', 'da', 'nb', 'fi', 'pl', 'cs', 'sk', 'sl', 'hr', 'sr', 'hu', 'ro', 'bg', 'el', 'et', 'lv', 'lt', 'ca', 'cy', 'ga', 'tr', 'ru', 'uk', 'ar', 'he', 'fa', 'ur', 'hi', 'bn', 'ta', 'id', 'ms', 'vi', 'th', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'sw', 'af');
  CREATE TYPE "public"."enum_redirects_redirect_type" AS ENUM('internal', 'external');
  CREATE TYPE "public"."enum_redirects_status_code" AS ENUM('301', '302');
  CREATE TYPE "public"."enum_privacy_requests_type" AS ENUM('access', 'erasure', 'withdraw-consent', 'correction', 'other');
  CREATE TYPE "public"."enum_privacy_requests_status" AS ENUM('received', 'in-progress', 'completed', 'refused');
  CREATE TYPE "public"."enum_forms_blocks_hidden_source" AS ENUM('page', 'param', 'referrer', 'fixed');
  CREATE TYPE "public"."enum_forms_confirmation_type" AS ENUM('message', 'redirect');
  CREATE TYPE "public"."enum_forms_protection_captcha" AS ENUM('none', 'altcha', 'turnstile');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TABLE "users_assigned_sites" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role_id" integer NOT NULL,
  	"is_super_admin" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "roles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"is_default_deployed" boolean DEFAULT false,
  	"operations_create" boolean DEFAULT false,
  	"operations_read" boolean DEFAULT false,
  	"operations_update" boolean DEFAULT false,
  	"operations_delete" boolean DEFAULT false,
  	"operations_publish" boolean DEFAULT false,
  	"operations_unpublish" boolean DEFAULT false,
  	"operations_clone_across_sites" boolean DEFAULT false,
  	"manage_site_settings" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "roles_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "sites_header_nav_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "sites_header_nav_items_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "sites_footer_columns_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "sites_footer_columns_links_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "sites_footer_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "sites_footer_columns_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "sites_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_sites_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "sites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"domain" varchar NOT NULL,
  	"theme" varchar NOT NULL,
  	"logo_id" integer,
  	"show_donate_button" boolean DEFAULT true,
  	"favicon_id" integer,
  	"primary_color" varchar DEFAULT '#f26522',
  	"secondary_color" varchar DEFAULT '#1a1a1a',
  	"heading_font_family" varchar,
  	"body_font_family" varchar,
  	"google_fonts_url" varchar,
  	"privacy_policy_url" varchar,
  	"privacy_contact_email" varchar,
  	"form_protection_turnstile_site_key" varchar,
  	"form_protection_turnstile_secret_key" varchar,
  	"custom_css" varchar,
  	"custom_js" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sites_locales" (
  	"tagline" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "sites_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"cta_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_text_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_text_block_locales" (
  	"heading" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_faq_accordion_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "pages_blocks_faq_accordion_items_locales" (
  	"question" varchar,
  	"answer" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_faq_accordion" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_accordion_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_feature_grid_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "pages_blocks_feature_grid_features_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_grid_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_form_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_form_embed_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_signup_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_signup_form_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"cta_label" varchar DEFAULT 'Join Now',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_leader_spotlight" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"photo_id" integer,
  	"cta_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_leader_spotlight_locales" (
  	"name" varchar,
  	"title" varchar,
  	"quote" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_donation_tiers_amounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric
  );
  
  CREATE TABLE "pages_blocks_donation_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"donate_href" varchar DEFAULT '/donate',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_donation_tiers_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_commitments_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"cta_href" varchar
  );
  
  CREATE TABLE "pages_blocks_commitments_grid_items_locales" (
  	"heading" varchar,
  	"body" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_commitments_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_commitments_grid_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer,
  	"slug" varchar,
  	"review_state" "enum_pages_review_state" DEFAULT 'none',
  	"review_note" varchar,
  	"status" "enum_pages_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_locales" (
  	"title" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"cta_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_text_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_text_block_locales" (
  	"heading" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_faq_accordion_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_accordion_items_locales" (
  	"question" varchar,
  	"answer" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_faq_accordion" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_accordion_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid_features_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_form_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_form_embed_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_signup_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_signup_form_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"cta_label" varchar DEFAULT 'Join Now',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_leader_spotlight" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"photo_id" integer,
  	"cta_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_leader_spotlight_locales" (
  	"name" varchar,
  	"title" varchar,
  	"quote" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_donation_tiers_amounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_donation_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"donate_href" varchar DEFAULT '/donate',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_donation_tiers_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_commitments_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"cta_href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_commitments_grid_items_locales" (
  	"heading" varchar,
  	"body" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_commitments_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_commitments_grid_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_site_id" integer,
  	"version_slug" varchar,
  	"version_review_state" "enum__pages_v_version_review_state" DEFAULT 'none',
  	"version_review_note" varchar,
  	"version_status" "enum__pages_v_version_status",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__pages_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_pages_v_locales" (
  	"version_title" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer,
  	"from_path" varchar NOT NULL,
  	"redirect_type" "enum_redirects_redirect_type" DEFAULT 'internal' NOT NULL,
  	"to_url" varchar,
  	"status_code" "enum_redirects_status_code" DEFAULT '301' NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "redirects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"media_id" integer,
  	"forms_id" integer
  );
  
  CREATE TABLE "privacy_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer,
  	"type" "enum_privacy_requests_type" DEFAULT 'access' NOT NULL,
  	"requester_email" varchar,
  	"received_at" timestamp(3) with time zone,
  	"due_at" timestamp(3) with time zone,
  	"status" "enum_privacy_requests_status" DEFAULT 'received' NOT NULL,
  	"completed_at" timestamp(3) with time zone,
  	"records_found" numeric,
  	"subject_hash" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "forms_blocks_checkbox" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"default_value" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_checkbox_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_country" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_country_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_email" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_email_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_message" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_message_locales" (
  	"message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_number" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"default_value" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_number_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select_options_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"placeholder" varchar,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_select_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_state" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_state_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_text_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_textarea" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_textarea_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_hidden" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar,
  	"source" "enum_forms_blocks_hidden_source" DEFAULT 'page' NOT NULL,
  	"value" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_emails" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email_to" varchar,
  	"cc" varchar,
  	"bcc" varchar,
  	"reply_to" varchar,
  	"email_from" varchar
  );
  
  CREATE TABLE "forms_emails_locales" (
  	"subject" varchar DEFAULT 'You''ve received a new message.' NOT NULL,
  	"message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer,
  	"title" varchar NOT NULL,
  	"confirmation_type" "enum_forms_confirmation_type" DEFAULT 'message',
  	"redirect_url" varchar,
  	"protection_captcha" "enum_forms_protection_captcha" DEFAULT 'none',
  	"landing_page_id" integer,
  	"privacy_purpose" varchar,
  	"privacy_consent_required" boolean DEFAULT false,
  	"privacy_consent_label" varchar,
  	"privacy_retention_days" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "forms_locales" (
  	"submit_button_label" varchar,
  	"confirmation_message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "form_submissions_submission_data" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "form_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer,
  	"form_id" integer NOT NULL,
  	"consent_given" boolean,
  	"consent_statement" varchar,
  	"consent_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_urls" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer,
  	"priority" numeric,
  	"path" varchar,
  	"doc_type" varchar,
  	"status" varchar,
  	"languages" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_urls_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "site_urls_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"redirects_id" integer
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"roles_id" integer,
  	"sites_id" integer,
  	"pages_id" integer,
  	"media_id" integer,
  	"redirects_id" integer,
  	"privacy_requests_id" integer,
  	"forms_id" integer,
  	"form_submissions_id" integer,
  	"site_urls_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_assigned_sites" ADD CONSTRAINT "users_assigned_sites_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_assigned_sites" ADD CONSTRAINT "users_assigned_sites_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roles_texts" ADD CONSTRAINT "roles_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_header_nav_items" ADD CONSTRAINT "sites_header_nav_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_header_nav_items_locales" ADD CONSTRAINT "sites_header_nav_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites_header_nav_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_footer_columns_links" ADD CONSTRAINT "sites_footer_columns_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites_footer_columns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_footer_columns_links_locales" ADD CONSTRAINT "sites_footer_columns_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites_footer_columns_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_footer_columns" ADD CONSTRAINT "sites_footer_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_footer_columns_locales" ADD CONSTRAINT "sites_footer_columns_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites_footer_columns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_social_links" ADD CONSTRAINT "sites_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites" ADD CONSTRAINT "sites_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sites" ADD CONSTRAINT "sites_favicon_id_media_id_fk" FOREIGN KEY ("favicon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sites_locales" ADD CONSTRAINT "sites_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sites_texts" ADD CONSTRAINT "sites_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_locales" ADD CONSTRAINT "pages_blocks_hero_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_text_block" ADD CONSTRAINT "pages_blocks_text_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_text_block_locales" ADD CONSTRAINT "pages_blocks_text_block_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_text_block"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_accordion_items" ADD CONSTRAINT "pages_blocks_faq_accordion_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_accordion_items_locales" ADD CONSTRAINT "pages_blocks_faq_accordion_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq_accordion_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_accordion" ADD CONSTRAINT "pages_blocks_faq_accordion_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_accordion_locales" ADD CONSTRAINT "pages_blocks_faq_accordion_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid_features" ADD CONSTRAINT "pages_blocks_feature_grid_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid_features_locales" ADD CONSTRAINT "pages_blocks_feature_grid_features_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feature_grid_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid" ADD CONSTRAINT "pages_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid_locales" ADD CONSTRAINT "pages_blocks_feature_grid_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_form_embed" ADD CONSTRAINT "pages_blocks_form_embed_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_form_embed" ADD CONSTRAINT "pages_blocks_form_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_form_embed_locales" ADD CONSTRAINT "pages_blocks_form_embed_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_form_embed"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_signup_form" ADD CONSTRAINT "pages_blocks_signup_form_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_signup_form" ADD CONSTRAINT "pages_blocks_signup_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_signup_form_locales" ADD CONSTRAINT "pages_blocks_signup_form_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_signup_form"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_leader_spotlight" ADD CONSTRAINT "pages_blocks_leader_spotlight_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_leader_spotlight" ADD CONSTRAINT "pages_blocks_leader_spotlight_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_leader_spotlight_locales" ADD CONSTRAINT "pages_blocks_leader_spotlight_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_leader_spotlight"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_donation_tiers_amounts" ADD CONSTRAINT "pages_blocks_donation_tiers_amounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_donation_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_donation_tiers" ADD CONSTRAINT "pages_blocks_donation_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_donation_tiers_locales" ADD CONSTRAINT "pages_blocks_donation_tiers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_donation_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_commitments_grid_items" ADD CONSTRAINT "pages_blocks_commitments_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_commitments_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_commitments_grid_items_locales" ADD CONSTRAINT "pages_blocks_commitments_grid_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_commitments_grid_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_commitments_grid" ADD CONSTRAINT "pages_blocks_commitments_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_commitments_grid_locales" ADD CONSTRAINT "pages_blocks_commitments_grid_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_commitments_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_locales" ADD CONSTRAINT "_pages_v_blocks_hero_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_text_block" ADD CONSTRAINT "_pages_v_blocks_text_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_text_block_locales" ADD CONSTRAINT "_pages_v_blocks_text_block_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_text_block"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_accordion_items" ADD CONSTRAINT "_pages_v_blocks_faq_accordion_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_accordion_items_locales" ADD CONSTRAINT "_pages_v_blocks_faq_accordion_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq_accordion_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_accordion" ADD CONSTRAINT "_pages_v_blocks_faq_accordion_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_accordion_locales" ADD CONSTRAINT "_pages_v_blocks_faq_accordion_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid_features" ADD CONSTRAINT "_pages_v_blocks_feature_grid_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid_features_locales" ADD CONSTRAINT "_pages_v_blocks_feature_grid_features_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_feature_grid_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid" ADD CONSTRAINT "_pages_v_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid_locales" ADD CONSTRAINT "_pages_v_blocks_feature_grid_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_form_embed" ADD CONSTRAINT "_pages_v_blocks_form_embed_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_form_embed" ADD CONSTRAINT "_pages_v_blocks_form_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_form_embed_locales" ADD CONSTRAINT "_pages_v_blocks_form_embed_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_form_embed"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_signup_form" ADD CONSTRAINT "_pages_v_blocks_signup_form_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_signup_form" ADD CONSTRAINT "_pages_v_blocks_signup_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_signup_form_locales" ADD CONSTRAINT "_pages_v_blocks_signup_form_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_signup_form"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_leader_spotlight" ADD CONSTRAINT "_pages_v_blocks_leader_spotlight_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_leader_spotlight" ADD CONSTRAINT "_pages_v_blocks_leader_spotlight_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_leader_spotlight_locales" ADD CONSTRAINT "_pages_v_blocks_leader_spotlight_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_leader_spotlight"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_donation_tiers_amounts" ADD CONSTRAINT "_pages_v_blocks_donation_tiers_amounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_donation_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_donation_tiers" ADD CONSTRAINT "_pages_v_blocks_donation_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_donation_tiers_locales" ADD CONSTRAINT "_pages_v_blocks_donation_tiers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_donation_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_commitments_grid_items" ADD CONSTRAINT "_pages_v_blocks_commitments_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_commitments_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_commitments_grid_items_locales" ADD CONSTRAINT "_pages_v_blocks_commitments_grid_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_commitments_grid_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_commitments_grid" ADD CONSTRAINT "_pages_v_blocks_commitments_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_commitments_grid_locales" ADD CONSTRAINT "_pages_v_blocks_commitments_grid_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_commitments_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_site_id_sites_id_fk" FOREIGN KEY ("version_site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects" ADD CONSTRAINT "redirects_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_forms_fk" FOREIGN KEY ("forms_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox" ADD CONSTRAINT "forms_blocks_checkbox_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_locales" ADD CONSTRAINT "forms_blocks_checkbox_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_country" ADD CONSTRAINT "forms_blocks_country_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_country_locales" ADD CONSTRAINT "forms_blocks_country_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_country"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_email" ADD CONSTRAINT "forms_blocks_email_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_email_locales" ADD CONSTRAINT "forms_blocks_email_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_email"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_message" ADD CONSTRAINT "forms_blocks_message_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_message_locales" ADD CONSTRAINT "forms_blocks_message_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_message"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_number" ADD CONSTRAINT "forms_blocks_number_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_number_locales" ADD CONSTRAINT "forms_blocks_number_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_number"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_options" ADD CONSTRAINT "forms_blocks_select_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_options_locales" ADD CONSTRAINT "forms_blocks_select_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select" ADD CONSTRAINT "forms_blocks_select_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_locales" ADD CONSTRAINT "forms_blocks_select_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_state" ADD CONSTRAINT "forms_blocks_state_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_state_locales" ADD CONSTRAINT "forms_blocks_state_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_text" ADD CONSTRAINT "forms_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_text_locales" ADD CONSTRAINT "forms_blocks_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_textarea" ADD CONSTRAINT "forms_blocks_textarea_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_textarea_locales" ADD CONSTRAINT "forms_blocks_textarea_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_textarea"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_hidden" ADD CONSTRAINT "forms_blocks_hidden_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_emails" ADD CONSTRAINT "forms_emails_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_emails_locales" ADD CONSTRAINT "forms_emails_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_emails"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms" ADD CONSTRAINT "forms_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forms" ADD CONSTRAINT "forms_landing_page_id_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forms_locales" ADD CONSTRAINT "forms_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_submission_data" ADD CONSTRAINT "form_submissions_submission_data_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_urls" ADD CONSTRAINT "site_urls_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_urls_locales" ADD CONSTRAINT "site_urls_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_urls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_urls_rels" ADD CONSTRAINT "site_urls_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_urls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_urls_rels" ADD CONSTRAINT "site_urls_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_urls_rels" ADD CONSTRAINT "site_urls_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sites_fk" FOREIGN KEY ("sites_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_privacy_requests_fk" FOREIGN KEY ("privacy_requests_id") REFERENCES "public"."privacy_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forms_fk" FOREIGN KEY ("forms_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_submissions_fk" FOREIGN KEY ("form_submissions_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_urls_fk" FOREIGN KEY ("site_urls_id") REFERENCES "public"."site_urls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_assigned_sites_order_idx" ON "users_assigned_sites" USING btree ("_order");
  CREATE INDEX "users_assigned_sites_parent_id_idx" ON "users_assigned_sites" USING btree ("_parent_id");
  CREATE INDEX "users_assigned_sites_site_idx" ON "users_assigned_sites" USING btree ("site_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_role_idx" ON "users" USING btree ("role_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "roles_name_idx" ON "roles" USING btree ("name");
  CREATE INDEX "roles_updated_at_idx" ON "roles" USING btree ("updated_at");
  CREATE INDEX "roles_created_at_idx" ON "roles" USING btree ("created_at");
  CREATE INDEX "roles_texts_order_parent" ON "roles_texts" USING btree ("order","parent_id");
  CREATE INDEX "sites_header_nav_items_order_idx" ON "sites_header_nav_items" USING btree ("_order");
  CREATE INDEX "sites_header_nav_items_parent_id_idx" ON "sites_header_nav_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "sites_header_nav_items_locales_locale_parent_id_unique" ON "sites_header_nav_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sites_footer_columns_links_order_idx" ON "sites_footer_columns_links" USING btree ("_order");
  CREATE INDEX "sites_footer_columns_links_parent_id_idx" ON "sites_footer_columns_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "sites_footer_columns_links_locales_locale_parent_id_unique" ON "sites_footer_columns_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sites_footer_columns_order_idx" ON "sites_footer_columns" USING btree ("_order");
  CREATE INDEX "sites_footer_columns_parent_id_idx" ON "sites_footer_columns" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "sites_footer_columns_locales_locale_parent_id_unique" ON "sites_footer_columns_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sites_social_links_order_idx" ON "sites_social_links" USING btree ("_order");
  CREATE INDEX "sites_social_links_parent_id_idx" ON "sites_social_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "sites_domain_idx" ON "sites" USING btree ("domain");
  CREATE INDEX "sites_logo_idx" ON "sites" USING btree ("logo_id");
  CREATE INDEX "sites_favicon_idx" ON "sites" USING btree ("favicon_id");
  CREATE INDEX "sites_updated_at_idx" ON "sites" USING btree ("updated_at");
  CREATE INDEX "sites_created_at_idx" ON "sites" USING btree ("created_at");
  CREATE UNIQUE INDEX "sites_locales_locale_parent_id_unique" ON "sites_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sites_texts_order_parent" ON "sites_texts" USING btree ("order","parent_id");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_idx" ON "pages_blocks_hero" USING btree ("image_id");
  CREATE UNIQUE INDEX "pages_blocks_hero_locales_locale_parent_id_unique" ON "pages_blocks_hero_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_text_block_order_idx" ON "pages_blocks_text_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_text_block_parent_id_idx" ON "pages_blocks_text_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_text_block_path_idx" ON "pages_blocks_text_block" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_text_block_locales_locale_parent_id_unique" ON "pages_blocks_text_block_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_faq_accordion_items_order_idx" ON "pages_blocks_faq_accordion_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_accordion_items_parent_id_idx" ON "pages_blocks_faq_accordion_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_blocks_faq_accordion_items_locales_locale_parent_id_un" ON "pages_blocks_faq_accordion_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_faq_accordion_order_idx" ON "pages_blocks_faq_accordion" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_accordion_parent_id_idx" ON "pages_blocks_faq_accordion" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_accordion_path_idx" ON "pages_blocks_faq_accordion" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_faq_accordion_locales_locale_parent_id_unique" ON "pages_blocks_faq_accordion_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_features_order_idx" ON "pages_blocks_feature_grid_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_features_parent_id_idx" ON "pages_blocks_feature_grid_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_blocks_feature_grid_features_locales_locale_parent_id_" ON "pages_blocks_feature_grid_features_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_order_idx" ON "pages_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_parent_id_idx" ON "pages_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_path_idx" ON "pages_blocks_feature_grid" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_feature_grid_locales_locale_parent_id_unique" ON "pages_blocks_feature_grid_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_form_embed_order_idx" ON "pages_blocks_form_embed" USING btree ("_order");
  CREATE INDEX "pages_blocks_form_embed_parent_id_idx" ON "pages_blocks_form_embed" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_form_embed_path_idx" ON "pages_blocks_form_embed" USING btree ("_path");
  CREATE INDEX "pages_blocks_form_embed_form_idx" ON "pages_blocks_form_embed" USING btree ("form_id");
  CREATE UNIQUE INDEX "pages_blocks_form_embed_locales_locale_parent_id_unique" ON "pages_blocks_form_embed_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_signup_form_order_idx" ON "pages_blocks_signup_form" USING btree ("_order");
  CREATE INDEX "pages_blocks_signup_form_parent_id_idx" ON "pages_blocks_signup_form" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_signup_form_path_idx" ON "pages_blocks_signup_form" USING btree ("_path");
  CREATE INDEX "pages_blocks_signup_form_form_idx" ON "pages_blocks_signup_form" USING btree ("form_id");
  CREATE UNIQUE INDEX "pages_blocks_signup_form_locales_locale_parent_id_unique" ON "pages_blocks_signup_form_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_leader_spotlight_order_idx" ON "pages_blocks_leader_spotlight" USING btree ("_order");
  CREATE INDEX "pages_blocks_leader_spotlight_parent_id_idx" ON "pages_blocks_leader_spotlight" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_leader_spotlight_path_idx" ON "pages_blocks_leader_spotlight" USING btree ("_path");
  CREATE INDEX "pages_blocks_leader_spotlight_photo_idx" ON "pages_blocks_leader_spotlight" USING btree ("photo_id");
  CREATE UNIQUE INDEX "pages_blocks_leader_spotlight_locales_locale_parent_id_uniqu" ON "pages_blocks_leader_spotlight_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_donation_tiers_amounts_order_idx" ON "pages_blocks_donation_tiers_amounts" USING btree ("_order");
  CREATE INDEX "pages_blocks_donation_tiers_amounts_parent_id_idx" ON "pages_blocks_donation_tiers_amounts" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_donation_tiers_order_idx" ON "pages_blocks_donation_tiers" USING btree ("_order");
  CREATE INDEX "pages_blocks_donation_tiers_parent_id_idx" ON "pages_blocks_donation_tiers" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_donation_tiers_path_idx" ON "pages_blocks_donation_tiers" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_donation_tiers_locales_locale_parent_id_unique" ON "pages_blocks_donation_tiers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_commitments_grid_items_order_idx" ON "pages_blocks_commitments_grid_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_commitments_grid_items_parent_id_idx" ON "pages_blocks_commitments_grid_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_blocks_commitments_grid_items_locales_locale_parent_id" ON "pages_blocks_commitments_grid_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_commitments_grid_order_idx" ON "pages_blocks_commitments_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_commitments_grid_parent_id_idx" ON "pages_blocks_commitments_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_commitments_grid_path_idx" ON "pages_blocks_commitments_grid" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_commitments_grid_locales_locale_parent_id_uniqu" ON "pages_blocks_commitments_grid_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_site_idx" ON "pages" USING btree ("site_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_image_idx" ON "_pages_v_blocks_hero" USING btree ("image_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_hero_locales_locale_parent_id_unique" ON "_pages_v_blocks_hero_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_text_block_order_idx" ON "_pages_v_blocks_text_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_text_block_parent_id_idx" ON "_pages_v_blocks_text_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_text_block_path_idx" ON "_pages_v_blocks_text_block" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_text_block_locales_locale_parent_id_unique" ON "_pages_v_blocks_text_block_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_accordion_items_order_idx" ON "_pages_v_blocks_faq_accordion_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_accordion_items_parent_id_idx" ON "_pages_v_blocks_faq_accordion_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_faq_accordion_items_locales_locale_parent_id" ON "_pages_v_blocks_faq_accordion_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_accordion_order_idx" ON "_pages_v_blocks_faq_accordion" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_accordion_parent_id_idx" ON "_pages_v_blocks_faq_accordion" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_accordion_path_idx" ON "_pages_v_blocks_faq_accordion" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_faq_accordion_locales_locale_parent_id_uniqu" ON "_pages_v_blocks_faq_accordion_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_features_order_idx" ON "_pages_v_blocks_feature_grid_features" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_features_parent_id_idx" ON "_pages_v_blocks_feature_grid_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_feature_grid_features_locales_locale_parent_" ON "_pages_v_blocks_feature_grid_features_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_order_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_parent_id_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_path_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_feature_grid_locales_locale_parent_id_unique" ON "_pages_v_blocks_feature_grid_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_form_embed_order_idx" ON "_pages_v_blocks_form_embed" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_form_embed_parent_id_idx" ON "_pages_v_blocks_form_embed" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_form_embed_path_idx" ON "_pages_v_blocks_form_embed" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_form_embed_form_idx" ON "_pages_v_blocks_form_embed" USING btree ("form_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_form_embed_locales_locale_parent_id_unique" ON "_pages_v_blocks_form_embed_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_signup_form_order_idx" ON "_pages_v_blocks_signup_form" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_signup_form_parent_id_idx" ON "_pages_v_blocks_signup_form" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_signup_form_path_idx" ON "_pages_v_blocks_signup_form" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_signup_form_form_idx" ON "_pages_v_blocks_signup_form" USING btree ("form_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_signup_form_locales_locale_parent_id_unique" ON "_pages_v_blocks_signup_form_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_leader_spotlight_order_idx" ON "_pages_v_blocks_leader_spotlight" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_leader_spotlight_parent_id_idx" ON "_pages_v_blocks_leader_spotlight" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_leader_spotlight_path_idx" ON "_pages_v_blocks_leader_spotlight" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_leader_spotlight_photo_idx" ON "_pages_v_blocks_leader_spotlight" USING btree ("photo_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_leader_spotlight_locales_locale_parent_id_un" ON "_pages_v_blocks_leader_spotlight_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_donation_tiers_amounts_order_idx" ON "_pages_v_blocks_donation_tiers_amounts" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_donation_tiers_amounts_parent_id_idx" ON "_pages_v_blocks_donation_tiers_amounts" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_donation_tiers_order_idx" ON "_pages_v_blocks_donation_tiers" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_donation_tiers_parent_id_idx" ON "_pages_v_blocks_donation_tiers" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_donation_tiers_path_idx" ON "_pages_v_blocks_donation_tiers" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_donation_tiers_locales_locale_parent_id_uniq" ON "_pages_v_blocks_donation_tiers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_commitments_grid_items_order_idx" ON "_pages_v_blocks_commitments_grid_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_commitments_grid_items_parent_id_idx" ON "_pages_v_blocks_commitments_grid_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_commitments_grid_items_locales_locale_parent" ON "_pages_v_blocks_commitments_grid_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_commitments_grid_order_idx" ON "_pages_v_blocks_commitments_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_commitments_grid_parent_id_idx" ON "_pages_v_blocks_commitments_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_commitments_grid_path_idx" ON "_pages_v_blocks_commitments_grid" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_commitments_grid_locales_locale_parent_id_un" ON "_pages_v_blocks_commitments_grid_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_site_idx" ON "_pages_v" USING btree ("version_site_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_site_idx" ON "media" USING btree ("site_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "redirects_site_idx" ON "redirects" USING btree ("site_id");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "redirects_rels_order_idx" ON "redirects_rels" USING btree ("order");
  CREATE INDEX "redirects_rels_parent_idx" ON "redirects_rels" USING btree ("parent_id");
  CREATE INDEX "redirects_rels_path_idx" ON "redirects_rels" USING btree ("path");
  CREATE INDEX "redirects_rels_pages_id_idx" ON "redirects_rels" USING btree ("pages_id");
  CREATE INDEX "redirects_rels_media_id_idx" ON "redirects_rels" USING btree ("media_id");
  CREATE INDEX "redirects_rels_forms_id_idx" ON "redirects_rels" USING btree ("forms_id");
  CREATE INDEX "privacy_requests_site_idx" ON "privacy_requests" USING btree ("site_id");
  CREATE INDEX "privacy_requests_updated_at_idx" ON "privacy_requests" USING btree ("updated_at");
  CREATE INDEX "privacy_requests_created_at_idx" ON "privacy_requests" USING btree ("created_at");
  CREATE INDEX "forms_blocks_checkbox_order_idx" ON "forms_blocks_checkbox" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_parent_id_idx" ON "forms_blocks_checkbox" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_path_idx" ON "forms_blocks_checkbox" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_checkbox_locales_locale_parent_id_unique" ON "forms_blocks_checkbox_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_country_order_idx" ON "forms_blocks_country" USING btree ("_order");
  CREATE INDEX "forms_blocks_country_parent_id_idx" ON "forms_blocks_country" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_country_path_idx" ON "forms_blocks_country" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_country_locales_locale_parent_id_unique" ON "forms_blocks_country_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_email_order_idx" ON "forms_blocks_email" USING btree ("_order");
  CREATE INDEX "forms_blocks_email_parent_id_idx" ON "forms_blocks_email" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_email_path_idx" ON "forms_blocks_email" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_email_locales_locale_parent_id_unique" ON "forms_blocks_email_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_message_order_idx" ON "forms_blocks_message" USING btree ("_order");
  CREATE INDEX "forms_blocks_message_parent_id_idx" ON "forms_blocks_message" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_message_path_idx" ON "forms_blocks_message" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_message_locales_locale_parent_id_unique" ON "forms_blocks_message_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_number_order_idx" ON "forms_blocks_number" USING btree ("_order");
  CREATE INDEX "forms_blocks_number_parent_id_idx" ON "forms_blocks_number" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_number_path_idx" ON "forms_blocks_number" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_number_locales_locale_parent_id_unique" ON "forms_blocks_number_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_select_options_order_idx" ON "forms_blocks_select_options" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_options_parent_id_idx" ON "forms_blocks_select_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_select_options_locales_locale_parent_id_unique" ON "forms_blocks_select_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_select_order_idx" ON "forms_blocks_select" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_parent_id_idx" ON "forms_blocks_select" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_path_idx" ON "forms_blocks_select" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_select_locales_locale_parent_id_unique" ON "forms_blocks_select_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_state_order_idx" ON "forms_blocks_state" USING btree ("_order");
  CREATE INDEX "forms_blocks_state_parent_id_idx" ON "forms_blocks_state" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_state_path_idx" ON "forms_blocks_state" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_state_locales_locale_parent_id_unique" ON "forms_blocks_state_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_text_order_idx" ON "forms_blocks_text" USING btree ("_order");
  CREATE INDEX "forms_blocks_text_parent_id_idx" ON "forms_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_text_path_idx" ON "forms_blocks_text" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_text_locales_locale_parent_id_unique" ON "forms_blocks_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_textarea_order_idx" ON "forms_blocks_textarea" USING btree ("_order");
  CREATE INDEX "forms_blocks_textarea_parent_id_idx" ON "forms_blocks_textarea" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_textarea_path_idx" ON "forms_blocks_textarea" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_textarea_locales_locale_parent_id_unique" ON "forms_blocks_textarea_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_hidden_order_idx" ON "forms_blocks_hidden" USING btree ("_order");
  CREATE INDEX "forms_blocks_hidden_parent_id_idx" ON "forms_blocks_hidden" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_hidden_path_idx" ON "forms_blocks_hidden" USING btree ("_path");
  CREATE INDEX "forms_emails_order_idx" ON "forms_emails" USING btree ("_order");
  CREATE INDEX "forms_emails_parent_id_idx" ON "forms_emails" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "forms_emails_locales_locale_parent_id_unique" ON "forms_emails_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_site_idx" ON "forms" USING btree ("site_id");
  CREATE INDEX "forms_landing_page_idx" ON "forms" USING btree ("landing_page_id");
  CREATE INDEX "forms_updated_at_idx" ON "forms" USING btree ("updated_at");
  CREATE INDEX "forms_created_at_idx" ON "forms" USING btree ("created_at");
  CREATE UNIQUE INDEX "forms_locales_locale_parent_id_unique" ON "forms_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "form_submissions_submission_data_order_idx" ON "form_submissions_submission_data" USING btree ("_order");
  CREATE INDEX "form_submissions_submission_data_parent_id_idx" ON "form_submissions_submission_data" USING btree ("_parent_id");
  CREATE INDEX "form_submissions_site_idx" ON "form_submissions" USING btree ("site_id");
  CREATE INDEX "form_submissions_form_idx" ON "form_submissions" USING btree ("form_id");
  CREATE INDEX "form_submissions_expires_at_idx" ON "form_submissions" USING btree ("expires_at");
  CREATE INDEX "form_submissions_updated_at_idx" ON "form_submissions" USING btree ("updated_at");
  CREATE INDEX "form_submissions_created_at_idx" ON "form_submissions" USING btree ("created_at");
  CREATE INDEX "site_urls_site_idx" ON "site_urls" USING btree ("site_id");
  CREATE INDEX "site_urls_doc_type_idx" ON "site_urls" USING btree ("doc_type");
  CREATE INDEX "site_urls_updated_at_idx" ON "site_urls" USING btree ("updated_at");
  CREATE INDEX "site_urls_created_at_idx" ON "site_urls" USING btree ("created_at");
  CREATE UNIQUE INDEX "site_urls_locales_locale_parent_id_unique" ON "site_urls_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_urls_rels_order_idx" ON "site_urls_rels" USING btree ("order");
  CREATE INDEX "site_urls_rels_parent_idx" ON "site_urls_rels" USING btree ("parent_id");
  CREATE INDEX "site_urls_rels_path_idx" ON "site_urls_rels" USING btree ("path");
  CREATE INDEX "site_urls_rels_pages_id_idx" ON "site_urls_rels" USING btree ("pages_id");
  CREATE INDEX "site_urls_rels_redirects_id_idx" ON "site_urls_rels" USING btree ("redirects_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("roles_id");
  CREATE INDEX "payload_locked_documents_rels_sites_id_idx" ON "payload_locked_documents_rels" USING btree ("sites_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_locked_documents_rels_privacy_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("privacy_requests_id");
  CREATE INDEX "payload_locked_documents_rels_forms_id_idx" ON "payload_locked_documents_rels" USING btree ("forms_id");
  CREATE INDEX "payload_locked_documents_rels_form_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("form_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_site_urls_id_idx" ON "payload_locked_documents_rels" USING btree ("site_urls_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_assigned_sites" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "roles" CASCADE;
  DROP TABLE "roles_texts" CASCADE;
  DROP TABLE "sites_header_nav_items" CASCADE;
  DROP TABLE "sites_header_nav_items_locales" CASCADE;
  DROP TABLE "sites_footer_columns_links" CASCADE;
  DROP TABLE "sites_footer_columns_links_locales" CASCADE;
  DROP TABLE "sites_footer_columns" CASCADE;
  DROP TABLE "sites_footer_columns_locales" CASCADE;
  DROP TABLE "sites_social_links" CASCADE;
  DROP TABLE "sites" CASCADE;
  DROP TABLE "sites_locales" CASCADE;
  DROP TABLE "sites_texts" CASCADE;
  DROP TABLE "pages_blocks_hero" CASCADE;
  DROP TABLE "pages_blocks_hero_locales" CASCADE;
  DROP TABLE "pages_blocks_text_block" CASCADE;
  DROP TABLE "pages_blocks_text_block_locales" CASCADE;
  DROP TABLE "pages_blocks_faq_accordion_items" CASCADE;
  DROP TABLE "pages_blocks_faq_accordion_items_locales" CASCADE;
  DROP TABLE "pages_blocks_faq_accordion" CASCADE;
  DROP TABLE "pages_blocks_faq_accordion_locales" CASCADE;
  DROP TABLE "pages_blocks_feature_grid_features" CASCADE;
  DROP TABLE "pages_blocks_feature_grid_features_locales" CASCADE;
  DROP TABLE "pages_blocks_feature_grid" CASCADE;
  DROP TABLE "pages_blocks_feature_grid_locales" CASCADE;
  DROP TABLE "pages_blocks_form_embed" CASCADE;
  DROP TABLE "pages_blocks_form_embed_locales" CASCADE;
  DROP TABLE "pages_blocks_signup_form" CASCADE;
  DROP TABLE "pages_blocks_signup_form_locales" CASCADE;
  DROP TABLE "pages_blocks_leader_spotlight" CASCADE;
  DROP TABLE "pages_blocks_leader_spotlight_locales" CASCADE;
  DROP TABLE "pages_blocks_donation_tiers_amounts" CASCADE;
  DROP TABLE "pages_blocks_donation_tiers" CASCADE;
  DROP TABLE "pages_blocks_donation_tiers_locales" CASCADE;
  DROP TABLE "pages_blocks_commitments_grid_items" CASCADE;
  DROP TABLE "pages_blocks_commitments_grid_items_locales" CASCADE;
  DROP TABLE "pages_blocks_commitments_grid" CASCADE;
  DROP TABLE "pages_blocks_commitments_grid_locales" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_text_block" CASCADE;
  DROP TABLE "_pages_v_blocks_text_block_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_accordion_items" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_accordion_items_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_accordion" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_accordion_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid_features" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid_features_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_form_embed" CASCADE;
  DROP TABLE "_pages_v_blocks_form_embed_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_signup_form" CASCADE;
  DROP TABLE "_pages_v_blocks_signup_form_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_leader_spotlight" CASCADE;
  DROP TABLE "_pages_v_blocks_leader_spotlight_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_donation_tiers_amounts" CASCADE;
  DROP TABLE "_pages_v_blocks_donation_tiers" CASCADE;
  DROP TABLE "_pages_v_blocks_donation_tiers_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_commitments_grid_items" CASCADE;
  DROP TABLE "_pages_v_blocks_commitments_grid_items_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_commitments_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_commitments_grid_locales" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_locales" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "redirects_rels" CASCADE;
  DROP TABLE "privacy_requests" CASCADE;
  DROP TABLE "forms_blocks_checkbox" CASCADE;
  DROP TABLE "forms_blocks_checkbox_locales" CASCADE;
  DROP TABLE "forms_blocks_country" CASCADE;
  DROP TABLE "forms_blocks_country_locales" CASCADE;
  DROP TABLE "forms_blocks_email" CASCADE;
  DROP TABLE "forms_blocks_email_locales" CASCADE;
  DROP TABLE "forms_blocks_message" CASCADE;
  DROP TABLE "forms_blocks_message_locales" CASCADE;
  DROP TABLE "forms_blocks_number" CASCADE;
  DROP TABLE "forms_blocks_number_locales" CASCADE;
  DROP TABLE "forms_blocks_select_options" CASCADE;
  DROP TABLE "forms_blocks_select_options_locales" CASCADE;
  DROP TABLE "forms_blocks_select" CASCADE;
  DROP TABLE "forms_blocks_select_locales" CASCADE;
  DROP TABLE "forms_blocks_state" CASCADE;
  DROP TABLE "forms_blocks_state_locales" CASCADE;
  DROP TABLE "forms_blocks_text" CASCADE;
  DROP TABLE "forms_blocks_text_locales" CASCADE;
  DROP TABLE "forms_blocks_textarea" CASCADE;
  DROP TABLE "forms_blocks_textarea_locales" CASCADE;
  DROP TABLE "forms_blocks_hidden" CASCADE;
  DROP TABLE "forms_emails" CASCADE;
  DROP TABLE "forms_emails_locales" CASCADE;
  DROP TABLE "forms" CASCADE;
  DROP TABLE "forms_locales" CASCADE;
  DROP TABLE "form_submissions_submission_data" CASCADE;
  DROP TABLE "form_submissions" CASCADE;
  DROP TABLE "site_urls" CASCADE;
  DROP TABLE "site_urls_locales" CASCADE;
  DROP TABLE "site_urls_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_sites_social_links_platform";
  DROP TYPE "public"."enum_pages_review_state";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_review_state";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum_redirects_redirect_type";
  DROP TYPE "public"."enum_redirects_status_code";
  DROP TYPE "public"."enum_privacy_requests_type";
  DROP TYPE "public"."enum_privacy_requests_status";
  DROP TYPE "public"."enum_forms_blocks_hidden_source";
  DROP TYPE "public"."enum_forms_confirmation_type";
  DROP TYPE "public"."enum_forms_protection_captcha";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
