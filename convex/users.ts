import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
} from "./_generated/server";
import { auth } from "./auth";
import { getAuthUserId } from "@convex-dev/auth/server";

const ADMIN_EMAIL = "shamanth.p2007@gmail.com";

// ─── Internal helper ──────────────────────────────────────

async function getCallerProfile(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

// ─── Upsert user on every login ───────────────────────────

export const upsertProfile = mutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if a users row already exists
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No identity");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // Determine role
    let role: "citizen" | "municipal" | "admin" = "citizen";
    const email = args.email.toLowerCase().trim();

    if (email === ADMIN_EMAIL) {
      role = "admin";
    } else {
      const permitted = await ctx.db
        .query("permittedUsers")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      if (permitted) {
        role = permitted.role;
      }
    }

    if (existing) {
      // Update name/avatar but preserve role unless it changed in permittedUsers
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        avatarUrl: args.avatarUrl ?? existing.avatarUrl,
        role: existing.role === "admin" ? "admin" : role,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    return user;
  },
});

// ─── Admin: list all users ────────────────────────────────

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") return [];
    return await ctx.db.query("users").collect();
  },
});

// ─── Admin: update role ───────────────────────────────────

export const updateRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("citizen"), v.literal("municipal"), v.literal("admin")) },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// ─── Admin: delete user ───────────────────────────────────

export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.delete(args.userId);
  },
});

// ─── Update avatar ────────────────────────────────────────

export const updateAvatar = mutation({
  args: { avatarUrl: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { avatarUrl: args.avatarUrl });
  },
});
