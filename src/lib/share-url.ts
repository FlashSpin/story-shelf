/** Public origin for absolute share links (relatives / clipboard). */
const PRODUCTION_ORIGIN = "https://story-shelf-six.vercel.app";

/** Path relatives should open — clean read-only browse, no editor chrome. */
export const SHARE_PATH = "/share";
export const SHARE_WISHLIST_PATH = "/share/wishlist";

export function absoluteShareUrl(path: string = SHARE_PATH): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `${PRODUCTION_ORIGIN}${path}`;
}

export async function copyShareUrl(path: string = SHARE_PATH): Promise<string> {
  const url = absoluteShareUrl(path);
  await navigator.clipboard.writeText(url);
  return url;
}
