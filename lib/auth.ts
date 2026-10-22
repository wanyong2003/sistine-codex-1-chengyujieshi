import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { getGoogleAuthProvider } from "./auth/google-auth";

const defaultTrustedOrigins = ["http://localhost:3000"];

const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : defaultTrustedOrigins;

const googleAuthProvider = getGoogleAuthProvider();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
  },
  ...(googleAuthProvider
    ? {
        socialProviders: {
          google: googleAuthProvider,
        },
      }
    : {}),

  trustedOrigins,

});

export { hashPassword } from "better-auth/crypto";
