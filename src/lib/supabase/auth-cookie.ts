type CookieName = { name: string };

const supabaseSessionCookie = /^sb-[a-zA-Z0-9_-]+-auth-token(?:\.\d+)?$/;

export function hasSupabaseSessionCookie(cookies: CookieName[]) {
  return cookies.some(({ name }) => supabaseSessionCookie.test(name));
}
