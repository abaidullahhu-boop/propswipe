import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  neighborhood: text("neighborhood"),
  latitude: decimal("latitude", { precision: 9, scale: 6 }),
  longitude: decimal("longitude", { precision: 9, scale: 6 }),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }).notNull(),
  squareFeet: integer("square_feet").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  videoStatus: text("video_status").notNull().default("ready"),
  durationSeconds: integer("duration_seconds"),
  filesizeBytes: integer("filesize_bytes"),
  width: integer("width"),
  height: integer("height"),
  plotId: varchar("plot_id").references(() => blockPlots.id),
  status: text("status").notNull().default("active"),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedProperties = pgTable("saved_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

export const propertyViews = pgTable("property_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const propertyDislikes = pgTable("property_dislikes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  dislikedAt: timestamp("disliked_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  message: text("message"),
  preferredDate: text("preferred_date"),
  preferredTime: text("preferred_time"),
  contactMethod: text("contact_method"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedFilters = pgTable("saved_filters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filtersJson: text("filters_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyReports = pgTable("property_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyAuditLogs = pgTable("property_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metaJson: text("meta_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyWatchEvents = pgTable("property_watch_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  watchedSeconds: integer("watched_seconds").notNull(),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dismissedAreas = pgTable("dismissed_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  city: text("city").notNull(),
  state: text("state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const societies = pgTable("societies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const societyBlocks = pgTable("society_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  societyId: varchar("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imagePath: text("image_path").notNull(),
  widthPx: integer("width_px").notNull(),
  heightPx: integer("height_px").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blockPlots = pgTable("block_plots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockId: varchar("block_id").notNull().references(() => societyBlocks.id, { onDelete: "cascade" }),
  plotNumber: text("plot_number").notNull(),
  x: decimal("x", { precision: 10, scale: 2 }).notNull(),
  y: decimal("y", { precision: 10, scale: 2 }).notNull(),
  size: text("size"),
  status: text("status").notNull().default("available"),
  metaJson: text("meta_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
}).transform((data) => ({
  ...data,
  passwordHash: data.password,
  password: undefined,
} as any));

/** Decimal columns validate as strings in drizzle-zod; clients often send numbers in JSON. */
const optionalDecimalString = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return undefined;
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  if (typeof val === "string") {
    const t = val.trim();
    return t === "" ? undefined : t;
  }
  return val;
}, z.string().optional());

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  views: true,
  createdAt: true,
}).extend({
  latitude: optionalDecimalString,
  longitude: optionalDecimalString,
});

export const insertSavedPropertySchema = createInsertSchema(savedProperties).omit({
  id: true,
  savedAt: true,
});

export const insertPropertyViewSchema = createInsertSchema(propertyViews).omit({
  id: true,
  viewedAt: true,
});

export const insertPropertyDislikeSchema = createInsertSchema(propertyDislikes).omit({
  id: true,
  dislikedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertSavedFilterSchema = createInsertSchema(savedFilters).omit({
  id: true,
  createdAt: true,
});

export const insertPropertyReportSchema = createInsertSchema(propertyReports).omit({
  id: true,
  createdAt: true,
});

export const insertPropertyAuditLogSchema = createInsertSchema(propertyAuditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPropertyWatchEventSchema = createInsertSchema(propertyWatchEvents).omit({
  id: true,
  createdAt: true,
});

export const insertDismissedAreaSchema = createInsertSchema(dismissedAreas).omit({
  id: true,
  createdAt: true,
});

export const insertSocietySchema = createInsertSchema(societies).omit({
  id: true,
  createdAt: true,
});

const coordinateNumberAsString = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return val;
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  if (typeof val === "string") return val.trim();
  return val;
}, z.string());

export const insertSocietyBlockSchema = createInsertSchema(societyBlocks).omit({
  id: true,
  createdAt: true,
});

export const insertBlockPlotSchema = createInsertSchema(blockPlots).omit({
  id: true,
  createdAt: true,
}).extend({
  x: coordinateNumberAsString,
  y: coordinateNumberAsString,
});

const optionalTrimmedString = z.preprocess((val) => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") {
    const t = val.trim();
    return t === "" ? undefined : t;
  }
  return val;
}, z.string().optional());

// Used for moving an existing marker (plot) on the block image.
// x/y are required because the marker position is the whole point.
export const updateBlockPlotPositionSchema = z.object({
  x: coordinateNumberAsString,
  y: coordinateNumberAsString,
  plotNumber: z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      const t = val.trim();
      return t === "" ? undefined : t;
    }
    return val;
  }, z.string().min(1).optional()),
  size: optionalTrimmedString,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

export type InsertSavedProperty = z.infer<typeof insertSavedPropertySchema>;
export type SavedProperty = typeof savedProperties.$inferSelect;

export type InsertPropertyView = z.infer<typeof insertPropertyViewSchema>;
export type PropertyView = typeof propertyViews.$inferSelect;

export type InsertPropertyDislike = z.infer<typeof insertPropertyDislikeSchema>;
export type PropertyDislike = typeof propertyDislikes.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedFilter = typeof savedFilters.$inferSelect;

export type InsertPropertyReport = z.infer<typeof insertPropertyReportSchema>;
export type PropertyReport = typeof propertyReports.$inferSelect;

export type InsertPropertyAuditLog = z.infer<typeof insertPropertyAuditLogSchema>;
export type PropertyAuditLog = typeof propertyAuditLogs.$inferSelect;

export type InsertPropertyWatchEvent = z.infer<typeof insertPropertyWatchEventSchema>;
export type PropertyWatchEvent = typeof propertyWatchEvents.$inferSelect;

export type InsertDismissedArea = z.infer<typeof insertDismissedAreaSchema>;
export type DismissedArea = typeof dismissedAreas.$inferSelect;

export type InsertSociety = z.infer<typeof insertSocietySchema>;
export type Society = typeof societies.$inferSelect;

export type InsertSocietyBlock = z.infer<typeof insertSocietyBlockSchema>;
export type SocietyBlock = typeof societyBlocks.$inferSelect;

export type InsertBlockPlot = z.infer<typeof insertBlockPlotSchema>;
export type BlockPlot = typeof blockPlots.$inferSelect;
