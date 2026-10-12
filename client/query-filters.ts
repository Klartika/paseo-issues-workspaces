// The filter menus edit the search query, as on github.com: picking a label adds `label:bug`.

export type FilterKey = "author" | "label" | "milestone" | "assignee" | "type";

/** Splits a query into words, keeping quoted text such as `label:"good first issue"` together. */
export function tokenize(query: string): string[] {
  return query.match(/(?:[^\s"]+|"[^"]*"?)+/g) ?? [];
}

type Qualifier = { negated: boolean; key: string; value: string };

function parse(token: string): Qualifier | null {
  const m = /^(-?)([a-z-]+):(.*)$/i.exec(token);
  if (!m) return null;
  return { negated: m[1] === "-", key: m[2].toLowerCase(), value: m[3].replace(/^"|"$/g, "") };
}

/** A value as GitHub search expects it: quoted when it has spaces. */
export function formatValue(value: string): string {
  const clean = value.replace(/"/g, "");
  return /\s/.test(clean) ? `"${clean}"` : clean;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Values of `key:` in the query, ignoring negated ones like `-label:bug`. */
export function filterValues(query: string, key: FilterKey): string[] {
  return tokenize(query).flatMap((t) => {
    const q = parse(t);
    return q && !q.negated && q.key === key ? [q.value] : [];
  });
}

/** Whether the query has `no:<key>`, e.g. `no:label`. */
export function hasNone(query: string, key: FilterKey): boolean {
  return tokenize(query).some((t) => {
    const q = parse(t);
    return q !== null && !q.negated && q.key === "no" && same(q.value, key);
  });
}

/** Drops every `key:` and `no:key` word, leaving negations and everything else. */
function without(tokens: string[], key: FilterKey, value?: string): string[] {
  return tokens.filter((t) => {
    const q = parse(t);
    if (!q || q.negated) return true;
    if (q.key === "no" && same(q.value, key)) return false;
    if (q.key !== key) return true;
    return value !== undefined && !same(q.value, value);
  });
}

/** Replaces any `key:` filter with `key:value`, or removes it when `value` is null. */
export function setFilter(query: string, key: FilterKey, value: string | null): string {
  const tokens = without(tokenize(query), key);
  if (value !== null) tokens.push(`${key}:${formatValue(value)}`);
  return tokens.join(" ");
}

/** Adds `key:value` alongside other values of `key`, or removes it if present. */
export function toggleFilter(query: string, key: FilterKey, value: string): string {
  const tokens = tokenize(query);
  const present = filterValues(query, key).some((v) => same(v, value));
  if (present) return without(tokens, key, value).filter((t) => !isNone(t, key)).join(" ");
  return [...tokens.filter((t) => !isNone(t, key)), `${key}:${formatValue(value)}`].join(" ");
}

function isNone(token: string, key: FilterKey) {
  const q = parse(token);
  return q !== null && !q.negated && q.key === "no" && same(q.value, key);
}

/** Switches `no:key` on (dropping every `key:` value) or off. */
export function setNone(query: string, key: FilterKey, on: boolean): string {
  const tokens = without(tokenize(query), key);
  if (on) tokens.push(`no:${key}`);
  return tokens.join(" ");
}

/**
 * Whether a person is selected under `key`; `@me` matches `me`, the signed-in login.
 */
export function personSelected(query: string, key: "author" | "assignee", login: string, me: string | null) {
  return filterValues(query, key).some((v) => same(v, login) || (v === "@me" && me !== null && same(login, me)));
}
