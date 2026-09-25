-- RLS with no policies: Supabase's auto-generated REST/GraphQL APIs can read nothing.
-- The API connects as the table owner, which bypasses RLS.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "company_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
