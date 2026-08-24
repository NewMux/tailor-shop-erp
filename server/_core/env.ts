function cleanEnvironmentValue(value: string | undefined): string {
  return value?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}

export const ENV = {
  databaseUrl: cleanEnvironmentValue(process.env.DATABASE_URL),
  ownerEmail: (process.env.OWNER_EMAIL ?? "").trim().toLowerCase(),
  authBaseUrl: cleanEnvironmentValue(process.env.AUTH_BASE_URL),
  allowedOrigin: cleanEnvironmentValue(process.env.ALLOWED_ORIGIN),
  isProduction: process.env.NODE_ENV === "production",
  secureCookies: process.env.NODE_ENV === "production",
  forgeApiUrl: cleanEnvironmentValue(process.env.BUILT_IN_FORGE_API_URL),
  forgeApiKey: cleanEnvironmentValue(process.env.BUILT_IN_FORGE_API_KEY),
};
