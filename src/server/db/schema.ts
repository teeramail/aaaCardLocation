import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  json
} from "drizzle-orm/pg-core";

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
    category: varchar("category", { length: 120 }).notNull().default("primary_school"),
    isMain: boolean("is_main").notNull().default(false),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    linkUrl: text("link_url"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    budget: numeric("budget", { precision: 15, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    userIdIndex: index("place_user_id_idx").on(table.userId),
    locationIndex: index("place_location_idx").on(table.latitude, table.longitude)
  })
);

export const cards = pgTable(
  "card",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    notes: text("notes"),
    linkUrl: text("link_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    userIdIndex: index("card_user_id_idx").on(table.userId),
    createdAtIndex: index("card_created_at_idx").on(table.createdAt)
  })
);

export const cardLocations = pgTable(
  "card_location",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    placeId: uuid("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    cardIdIndex: index("card_location_card_id_idx").on(table.cardId),
    placeIdIndex: index("card_location_place_id_idx").on(table.placeId),
    cardPlaceUniqueIndex: uniqueIndex("card_location_card_place_idx").on(table.cardId, table.placeId)
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

export const placeCategories = pgTable(
  "user_category",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    color: varchar("color", { length: 32 }).notNull().default("slate"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIndex: index("user_category_user_id_idx").on(table.userId),
    slugUniqueIndex: uniqueIndex("user_category_slug_user_idx").on(table.userId, table.slug)
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
  cards: many(cards),
  placeImages: many(placeImages),
  userTracks: many(userTracks),
  placeCategories: many(placeCategories)
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  user: one(users, {
    fields: [places.userId],
    references: [users.id]
  }),
  cardLinks: many(cardLocations),
  images: many(placeImages)
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  user: one(users, {
    fields: [cards.userId],
    references: [users.id]
  }),
  locations: many(cardLocations)
}));

export const cardLocationsRelations = relations(cardLocations, ({ one }) => ({
  card: one(cards, {
    fields: [cardLocations.cardId],
    references: [cards.id]
  }),
  place: one(places, {
    fields: [cardLocations.placeId],
    references: [places.id]
  })
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

export const placeCategoriesRelations = relations(placeCategories, ({ one }) => ({
  user: one(users, {
    fields: [placeCategories.userId],
    references: [users.id]
  })
}));

export type User = typeof users.$inferSelect;
export type Place = typeof places.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type CardLocation = typeof cardLocations.$inferSelect;
export type PlaceImage = typeof placeImages.$inferSelect;
export type UserTrack = typeof userTracks.$inferSelect;
export type PlaceCategory = typeof placeCategories.$inferSelect;

