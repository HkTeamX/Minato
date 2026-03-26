CREATE TABLE "pigeon_histories" (
	"id" bigserial PRIMARY KEY,
	"user_id" bigserial,
	"operation" bigint NOT NULL,
	"prev_num" bigint NOT NULL,
	"current_num" bigint NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pigeons" (
	"id" bigserial PRIMARY KEY,
	"pigeon_num" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
