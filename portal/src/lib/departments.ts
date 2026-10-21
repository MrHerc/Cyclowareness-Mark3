/**
 * How department names are told apart: case-insensitive, with the Azerbaijani/Turkish dotted and
 * dotless i folded together ("SATIŞ", "Satış" and "satiş" are one department). The CSV import matches
 * names by this key, so two departments of one organisation must never share it: it is stored with every
 * new name as departments.name_key, under a unique index per organisation.
 */
export const departmentKey = (name: string) => name.trim().normalize("NFC").replace(/[İı]/g, "i").toLowerCase();
