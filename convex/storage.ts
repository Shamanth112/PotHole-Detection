import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Returns a short-lived upload URL for client-side file uploads */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Resolves a storage ID to a public URL */
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
