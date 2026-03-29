import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { MutationCtx } from "./_generated/server";

const ADMIN_EMAIL = "shamanth.p2007@gmail.com";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      // ctx here is a special mutation-like context. Cast it so we can use
      // our custom "profiles" and "permittedUsers" tables.
      const db = (ctx as unknown as MutationCtx).db;
      const { userId, profile } = args;

      const existing = await db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (existing) {
        // Update name/avatar on re-login (preserve role)
        await db.patch(existing._id, {
          name: (profile?.name as string | undefined) ?? existing.name,
          avatarUrl: (profile?.picture as string | undefined) ?? existing.avatarUrl,
        });
      } else {
        // First login — create the profile row
        const email = ((profile?.email as string) ?? "").toLowerCase().trim();

        let role: "citizen" | "municipal" | "admin" = "citizen";
        if (email === ADMIN_EMAIL) {
          role = "admin";
        } else {
          const permitted = await db
            .query("permittedUsers")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique();
          if (permitted) {
            role = permitted.role;
          }
        }

        await db.insert("profiles", {
          userId,
          email,
          name: profile?.name as string | undefined,
          avatarUrl: profile?.picture as string | undefined,
          role,
        });
      }
    },
  },
});
