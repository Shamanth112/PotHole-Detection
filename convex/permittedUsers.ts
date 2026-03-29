import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function getCallerProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") return [];
    return await ctx.db.query("permittedUsers").collect();
  },
});

export const upsert = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("citizen"), v.literal("municipal"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");

    const email = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("permittedUsers")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
    } else {
      await ctx.db.insert("permittedUsers", { email, role: args.role });
    }
  },
});

export const remove = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("permittedUsers")
      .withIndex("by_email", (q: any) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const updateRole = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("citizen"), v.literal("municipal"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("permittedUsers")
      .withIndex("by_email", (q: any) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
    }
  },
});
