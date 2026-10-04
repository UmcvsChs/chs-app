// A related record fetched together with its parent (for example the property
// behind a booking) arrives from the database as ONE object when each parent
// has a single such record, and as a LIST when it can have many. Code that
// assumed a list (`x.properties?.[0]?.title`) silently got `undefined` for the
// single-object case — so screens showed the generic word "Property" and
// blank locations instead of the real name. This accepts either shape.
export function embeddedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
