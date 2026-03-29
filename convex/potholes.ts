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

// ─── Public: list potholes ────────────────────────────────

// Citizens see only their own; admin/municipal see all
export const list = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getCallerProfile(ctx);
    if (!caller) return [];

    if (caller.role === "admin" || caller.role === "municipal") {
      const rows = await ctx.db.query("potholes").order("desc").take(200);
      return rows;
    }

    const rows = await ctx.db
      .query("potholes")
      .withIndex("by_user", (q: any) => q.eq("userId", caller._id))
      .order("desc")
      .take(50);
    return rows;
  },
});

// Always all — used by Municipal and Admin dashboards
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getCallerProfile(ctx);
    if (!caller) return [];
    if (caller.role !== "admin" && caller.role !== "municipal") return [];
    return await ctx.db.query("potholes").order("desc").take(200);
  },
});

// ─── Report a new pothole ─────────────────────────────────

export const report = mutation({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    address: v.optional(v.string()),
    reportImageId: v.optional(v.id("_storage")),
    reportImageUrl: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller) throw new Error("Not authenticated");

    await ctx.db.insert("potholes", {
      userId: caller.userId,
      userName: args.userName ?? caller.name ?? "Road Guardian",
      latitude: args.latitude,
      longitude: args.longitude,
      severity: args.severity,
      address: args.address,
      status: "reported",
      reportImageId: args.reportImageId,
      reportImageUrl: args.reportImageUrl,
    });
  },
});

// ─── Update status (municipal/admin) ──────────────────────

export const updateStatus = mutation({
  args: {
    potholeId: v.id("potholes"),
    status: v.union(
      v.literal("reported"),
      v.literal("verified"),
      v.literal("fixing"),
      v.literal("in-progress"),
      v.literal("resolved"),
      v.literal("dismissed")
    ),
    resolvedImageId: v.optional(v.id("_storage")),
    resolvedImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller) throw new Error("Not authenticated");
    if (caller.role !== "admin" && caller.role !== "municipal")
      throw new Error("Unauthorized");

    const patch: any = { status: args.status };
    if (args.resolvedImageId) patch.resolvedImageId = args.resolvedImageId;
    if (args.resolvedImageUrl) patch.resolvedImageUrl = args.resolvedImageUrl;

    await ctx.db.patch(args.potholeId, patch);
  },
});

// ─── Update pothole metadata (admin) ──────────────────────

export const updatePothole = mutation({
  args: {
    potholeId: v.id("potholes"),
    status: v.optional(v.string()),
    severity: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");

    const patch: any = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.severity !== undefined) patch.severity = args.severity;
    if (args.address !== undefined) patch.address = args.address;

    await ctx.db.patch(args.potholeId, patch);
  },
});

// ─── Delete (admin) ───────────────────────────────────────

export const deletePothole = mutation({
  args: { potholeId: v.id("potholes") },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.delete(args.potholeId);
  },
});

// ─── Manual entry (admin) ─────────────────────────────────

export const addManual = mutation({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerProfile(ctx);
    if (!caller || caller.role !== "admin") throw new Error("Unauthorized");

    await ctx.db.insert("potholes", {
      userId: caller.userId,
      userName: "Admin Manual Entry",
      latitude: args.latitude,
      longitude: args.longitude,
      severity: args.severity,
      address: args.address ?? "Manual Entry",
      status: "reported",
    });
  },
});
