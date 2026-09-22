import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { developerApps } from "./schema";

export const developerOauthClients = pgTable("developer_oauth_clients", {
  appId: text("app_id").primaryKey().references(() => developerApps.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  clientSecretHash: text("client_secret_hash").notNull(),
  secretPrefix: text("secret_prefix").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().default([]).notNull(),
  scopes: jsonb("scopes").$type<string[]>().default(["identify"]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("developer_oauth_client_id_unique").on(table.clientId)]);

export const developerWebhooks = pgTable("developer_webhooks", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull().references(() => developerApps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  eventTypes: jsonb("event_types").$type<string[]>().default([]).notNull(),
  secretHash: text("secret_hash").notNull(),
  secretPrefix: text("secret_prefix").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("developer_webhooks_app_idx").on(table.appId)]);
