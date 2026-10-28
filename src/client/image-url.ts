/**
 * The image-URL rule every occupant applies: a brand image and the running
 * indicator's mark both accept the same sources.
 *
 * Kept out of the branding module so a non-React consumer can share one rule;
 * `branding.tsx` re-exports it for the rows that already import it from there.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/image-url
 */

/**
 * Accept web images and same-origin absolute paths; reject script and file URLs.
 * @param value - the stored URL, or undefined when nothing is stored.
 * @returns the URL to use, or `''` when the stored value is not displayable.
 */
export function imageUrl(value: string | undefined): string {
  const url = value?.trim() ?? ''
  if (/^https?:\/\/\S+$/i.test(url)) return url
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\') && !/\s/.test(url)) return url
  return ''
}
