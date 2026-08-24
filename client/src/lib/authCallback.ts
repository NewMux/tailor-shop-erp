export function getPasswordResetToken(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const token = params.get("reset_token");
  return token?.trim() || null;
}
