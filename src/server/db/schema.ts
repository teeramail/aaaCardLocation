import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  json
} from "drizzle-orm/pg-core";

export const placeCategoryEnum = pgEnum("place_category", [
  "primary_school",
  "secondary_school",
  "university",
  "office",
  "home",
  "other"
]);

export const users = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    image: text("image"),
    role: varchar("role", { length: 32 }).notNull().default("owner"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    emailIndex: uniqueIndex("user_email_idx").on(table.email)
  })
);

export const places = pgTable(
  "place",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    city: varchar("city", { length: 120 }),
    country: varchar("country", { length: 120 }),
    category: placeCategoryEnum("category").notNull().default("primary_school"),
    isMain: boolean("is_main").notNull().default(false),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    userIdIndex: index("place_user_id_idx").on(table.userId),
    locationIndex: index("place_location_idx").on(table.latitude, table.longitude)
  })
);

export const userTracks = pgTable(
  "user_track",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    points: json("points").notNull(), // Will store Array<{lat: number, lng: number}>
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    userIdIndex: index("user_track_user_id_idx").on(table.userId)
  })
);

export const dismissedSamples = pgTable(
  "dismissed_sample",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sampleKey: varchar("sample_key", { length: 512 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: uniqueIndex("dismissed_sample_pk").on(table.userId, table.sampleKey)
  })
);

export const placeImages = pgTable(
  "place_image",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    imageUrl: text("image_url").notNull(),
    altText: varchar("alt_text", { length: 255 }),
    width: integer("width"),
    height: integer("height"),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    placeIdIndex: index("place_image_place_id_idx").on(table.placeId),
    primaryImageIndex: index("place_image_primary_idx").on(table.placeId, table.isPrimary)
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  places: many(places),
  placeImages: many(placeImages),
  userTracks: many(userTracks)
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  user: one(users, {
    fields: [places.userId],
    references: [users.id]
  }),
  images: many(placeImages)
}));

export const placeImagesRelations = relations(placeImages, ({ one }) => ({
  place: one(places, {
    fields: [placeImages.placeId],
    references: [places.id]
  }),
  user: one(users, {
    fields: [placeImages.userId],
    references: [users.id]
  })
}));

export const userTracksRelations = relations(userTracks, ({ one }) => ({
  user: one(users, {
    fields: [userTracks.userId],
    references: [users.id]
  })
}));

export type User = typeof users.$inferSelect;
export type Place = typeof places.$inferSelect;
export type PlaceImage = typeof placeImages.$inferSelect;
export type UserTrack = typeof userTracks.$inferSelect;

export const placesSelectSql = sql`
  ${places.id},
  ${places.userId},
  ${places.name},
  ${places.description},
  ${places.city},
  ${places.country},
  ${places.category},
  ${places.latitude},
  ${places.longitude},
  ${places.createdAt},
  ${places.updatedAt}
`;
