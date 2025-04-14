CREATE TYPE "public"."visual_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "visuals" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"placeholder_id" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"search_query" text,
	"status" "visual_status" DEFAULT 'PENDING' NOT NULL,
	"image_url" varchar(2048),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visuals" ADD CONSTRAINT "visuals_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;