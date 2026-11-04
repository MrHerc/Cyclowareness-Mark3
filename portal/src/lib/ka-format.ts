import { type AzDateOptions, type RelativeUnit, fieldsIn } from "./az-format";

/**
 * Georgian dates and relative times without ICU locale data. Chrome and Edge ship no `ka` data at all
 * (`Intl.DateTimeFormat("ka")` resolves to en-US: "November 4, 2026", "3 days ago"), so, as for az in
 * az-format.ts, these reproduce ICU's `ka` patterns and next-intl's relative-time rules exactly
 * (tests/ka-format.test.ts checks them against Node's full ICU). Numbers come from the FormatJS polyfill
 * instead, which `<AzNumbersGate>` also loads on ka pages (i18n/az-numbers.ts).
 */

const MONTHS_SHORT = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
const MONTHS_LONG = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const WEEKDAYS = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];

const two = (n: number) => String(n).padStart(2, "0");

export function formatKaDate(date: Date, o: AzDateOptions = { dateStyle: "medium" }, timeZone?: string): string {
  const f = fieldsIn(date, timeZone);
  const time = `${two(f.hour)}:${two(f.minute)}`;
  if ("day" in o && o.month === "numeric") {
    const d = `${f.day}.${f.month + 1}.${f.year}`;
    return o.timeStyle ? `${d}, ${time}` : d;
  }
  if ("day" in o) {
    if (o.month === "long") return o.year ? `${f.day} ${MONTHS_LONG[f.month]}, ${f.year}` : `${f.day} ${MONTHS_LONG[f.month]}`;
    return o.year ? `${f.day} ${MONTHS_SHORT[f.month]}. ${f.year}` : `${f.day} ${MONTHS_SHORT[f.month]}`;
  }
  const d =
    o.dateStyle === "short"
      ? `${two(f.day)}.${two(f.month + 1)}.${two(f.year % 100)}`
      : o.dateStyle === "long"
        ? `${f.day} ${MONTHS_LONG[f.month]}, ${f.year}`
        : o.dateStyle === "full"
          ? `${WEEKDAYS[f.weekday]}, ${two(f.day)} ${MONTHS_LONG[f.month]}, ${f.year}`
          : o.dateStyle === "medium"
            ? `${f.day} ${MONTHS_SHORT[f.month]}. ${f.year}`
            : "";
  return d && o.timeStyle ? `${d}, ${time}` : d || (o.timeStyle ? time : "");
}

const AGO: Record<RelativeUnit, string> = { second: "წამის", minute: "წუთის", hour: "საათის", day: "დღის", week: "კვირის", month: "თვის", year: "წლის" };
const IN: Record<RelativeUnit, string> = { second: "წამში", minute: "წუთში", hour: "საათში", day: "დღეში", week: "კვირაში", month: "თვეში", year: "წელიწადში" };

/** What next-intl prints with ICU ka: counts always ("1 დღის წინ", not "გუშინ"), except "ახლა" for 0 seconds. */
export function formatKaRelative(value: number, unit: RelativeUnit): string {
  if (value === 0 && unit === "second") return "ახლა";
  return value < 0 ? `${-value} ${AGO[unit]} წინ` : `${value} ${IN[unit]}`;
}
