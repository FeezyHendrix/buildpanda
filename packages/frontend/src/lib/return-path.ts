/** Only local app paths may survive the sign-in round trip. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return null;
  const url = new URL(value, "https://local.invalid");
  if (url.origin !== "https://local.invalid" || url.pathname.startsWith("/auth")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function signInPath(path: string): string {
  const target = safeReturnPath(path);
  return target ? `/auth/sign-in?redirect=${encodeURIComponent(target)}` : "/auth/sign-in";
}
