import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    // Convex Auth links via tokenIdentifier
    tokenIdentifier: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("citizen"), v.literal("municipal"), v.literal("admin")),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  potholes: defineTable({
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    address: v.optional(v.string()),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(
      v.literal("reported"),
      v.literal("verified"),
      v.literal("fixing"),
      v.literal("in-progress"),
      v.literal("resolved"),
      v.literal("dismissed")
    ),
    reportImageId: v.optional(v.id("_storage")),
    resolvedImageId: v.optional(v.id("_storage")),
    // We also keep raw URL fields for backwards compat / external images
    reportImageUrl: v.optional(v.string()),
    resolvedImageUrl: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  permittedUsers: defineTable({
    email: v.string(),
    role: v.union(v.literal("citizen"), v.literal("municipal"), v.literal("admin")),
  }).index("by_email", ["email"]),
});

