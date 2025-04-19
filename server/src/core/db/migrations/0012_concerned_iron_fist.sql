ALTER TYPE "public"."visual_status" ADD VALUE 'PENDING_GENERATION' BEFORE 'PROCESSING';--> statement-breakpoint
ALTER TYPE "public"."visual_status" ADD VALUE 'NO_IMAGE_FOUND';--> statement-breakpoint
ALTER TABLE "visuals" ADD COLUMN "concept" text NOT NULL;--> statement-breakpoint
ALTER TABLE "visuals" ADD COLUMN "alt_text" text;--> statement-breakpoint
ALTER TABLE "visuals" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "visuals" ADD COLUMN "source_title" text;