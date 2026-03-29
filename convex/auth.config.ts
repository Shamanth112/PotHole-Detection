import { convexAuth } from "./auth";
import { Mutation } from "./_generated/server";
import { internal } from "./_generated/server";

export default convexAuth({
  onMountAuthenticatedSession: (session) => session,
  onSignIn: async ({ user, session, profile }) => {
    // Call upsertProfile when user signs in
    await internal.users.upsertProfile({
      name: profile?.name,
      avatarUrl: profile?.picture,
      email: user.email ?? "",
    });
  },
  onSignOut: async ({ session }) => {
    // Optional: clean up on sign out
  },
});