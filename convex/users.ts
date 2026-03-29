import { v } from "convex/values";
import {
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const ADMIN_EMAIL = "shamanth.p2007@gmail.com";

// ─── Internal helper ──────────────────────────────────────

async function getCallerProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

// ─── Upsert profile on every login ────────────────────────

export const upsertProfile = mutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const email = args.email.toLowerCase().trim();

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // Determine role
    let role: "citizen" | "municipal" | "admin" = "citizen";

    if (email === ADMIN_EMAIL) {
      role = "admin";
    } else {
      const permitted = await ctx.db
        .query("permittedUsers")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (permitted) {
        role = permitted.role;
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        avatarUrl: args.avatarUrl ?? existing.avatarUrl,
        role: existing.role === "admin" ? "admin" : role,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("profiles", {
        userId,
        email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        role,
      });
      return id;
    }
  },
});

// ─── Get current user profile ─────────────────────────────

export const getSelf = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

// ─── Admin: list all users ────────────────────────────────

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") return [];
    return await ctx.db.query("profiles").collect();
  },
});

// ─── Admin: update role ───────────────────────────────────

export const updateRole = mutation({
  args: {
    profileId: v.id("profiles"),
    role: v.union(v.literal("citizen"), v.literal("municipal"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.patch(args.profileId, { role: args.role });
  },
});

// ─── Admin: delete user ───────────────────────────────────

export const deleteUser = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.delete(args.profileId);
  },
});

// ─── Update avatar ────────────────────────────────────────

export const updateAvatar = mutation({
  args: { avatarUrl: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, { avatarUrl: args.avatarUrl });
  },
});
