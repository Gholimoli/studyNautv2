CREATE TYPE "public"."processing_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE');--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"source_type" "source_type" NOT NULL,
	"original_url" varchar(2048),
	"original_filename" varchar(255),
	"extracted_text" text,
	"metadata" jsonb,
	"processing_status" "processing_status" DEFAULT 'PENDING' NOT NULL,
	"processing_stage" varchar(100),
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;