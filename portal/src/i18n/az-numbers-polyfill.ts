/**
 * FormatJS's Intl.NumberFormat with the data of every interface language: the chunk that
 * `azNumbersReady` (az-numbers.ts) loads in a browser without Azerbaijani number data. The polyfill
 * replaces Intl.NumberFormat for every language, so the others need their data too (a page can switch
 * its language or embed another one, see TeachableLocale). English goes first because the first
 * locale registered becomes the fallback for any other. Import order is evaluation order.
 */
import "@formatjs/intl-numberformat/polyfill-force.js";
import "@formatjs/intl-numberformat/locale-data/en.js";
import "@formatjs/intl-numberformat/locale-data/az.js";
import "@formatjs/intl-numberformat/locale-data/ru.js";
import "@formatjs/intl-numberformat/locale-data/tr.js";
import "@formatjs/intl-numberformat/locale-data/ro.js";
import "@formatjs/intl-numberformat/locale-data/ka.js";
import "@formatjs/intl-numberformat/locale-data/uk.js";
import "@formatjs/intl-numberformat/locale-data/de.js";
import "@formatjs/intl-numberformat/locale-data/fr.js";
import "@formatjs/intl-numberformat/locale-data/ar.js";
