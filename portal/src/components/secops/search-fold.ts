/**
 * Comparable form of a name or title for search boxes: "İ".toLowerCase() is "i" plus a combining dot,
 * so "ilham" would not find "İlham"; Azerbaijani ı, Russian ё and letters with diacritics compare as
 * their plain forms ("ismayil" finds "İsmayıl"). Locale-independent, unlike toLocaleLowerCase().
 */
export function searchFold(s: string): string {
  return s.toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "");
}
