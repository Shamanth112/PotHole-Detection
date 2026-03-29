import { convexAuth } from "./auth";
import { internal } from "./_generated/server";
import { httpAction } from "./_generated/server";

export default convexAuth({
  onMountAuthenticatedSession: (session) => session,
  onSignIn: async ({ user, session, profile }) => {
    console.log("DEBUG: onSignIn called with", { email: user.email, name: profile?.name });
    try {
      // Call upsertProfile when user signs in
      await internal.users.upsertProfile({
        name: profile?.name,
        avatarUrl: profile?.picture,
        email: user.email ?? "",
      });
      console.log("DEBUG: upsertProfile completed");
    } catch (err) {
      console.error("DEBUG: upsertProfile failed:", err);
    }
  },
  onSignOut: async ({ session }) => {
    console.log("DEBUG: onSignOut called");
  },
});