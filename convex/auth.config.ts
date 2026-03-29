import { convexAuth } from "./auth";
import { internal } from "./_generated/server";

export default convexAuth({
  onMountAuthenticatedSession: (session) => session,
  onSignIn: async ({ user, session, profile }) => {
    // Use setUser to store user info directly
    await internal.users.upsertProfile({
      name: profile?.name,
      avatarUrl: profile?.picture,
      email: user.email ?? "",
    });
  },
});