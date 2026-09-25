CREATE TYPE "public"."attendance_status" AS ENUM('CHECKED_IN', 'COMPLETED', 'MISSED_CHECKOUT');--> statement-breakpoint
CREATE TYPE "public"."attendance_event_result" AS ENUM('ACCEPTED', 'OUTSIDE_SITE', 'LOW_ACCURACY', 'ALREADY_CHECKED_IN', 'ALREADY_CHECKED_OUT', 'NOT_CHECKED_IN', 'NO_SITE');--> statement-breakpoint
CREATE TYPE "public"."attendance_event_type" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'employee');--> statement-breakpoint
CREATE TABLE "attendance_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"site_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_in_lat" double precision NOT NULL,
	"check_in_lng" double precision NOT NULL,
	"check_in_accuracy_m" double precision NOT NULL,
	"check_in_distance_m" double precision NOT NULL,
	"check_out_at" timestamp with time zone,
	"check_out_lat" double precision,
	"check_out_lng" double precision,
	"check_out_accuracy_m" double precision,
	"check_out_distance_m" double precision,
	"worked_minutes" integer,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_day_id" uuid,
	"work_date" date NOT NULL,
	"type" "attendance_event_type" NOT NULL,
	"result" "attendance_event_result" NOT NULL,
	"server_time" timestamp with time zone NOT NULL,
	"device_time" timestamp with time zone,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" double precision NOT NULL,
	"distance_m" double precision,
	"is_mock" boolean NOT NULL,
	"device_id" text,
	"device_model" text,
	"app_version" text,
	"ip" text,
	"idempotency_key" uuid NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	CONSTRAINT "attendance_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"max_accuracy_m" integer DEFAULT 50 NOT NULL,
	"default_radius_m" integer DEFAULT 50 NOT NULL,
	"reminder_time" text DEFAULT '19:00' NOT NULL,
	"clock_mismatch_minutes" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_settings_singleton" CHECK ("company_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"prev_refresh_token_hash" text,
	"rotated_at" timestamp with time zone,
	"device_id" text,
	"device_model" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_m" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"employee_code" text,
	"email" text,
	"pin_hash" text,
	"password_hash" text,
	"site_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_employee_code_unique" UNIQUE("employee_code"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_attendance_day_id_attendance_days_id_fk" FOREIGN KEY ("attendance_day_id") REFERENCES "public"."attendance_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_days_employee_date_uq" ON "attendance_days" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_days_date_idx" ON "attendance_days" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "attendance_days_status_idx" ON "attendance_days" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attendance_events_employee_date_idx" ON "attendance_events" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");