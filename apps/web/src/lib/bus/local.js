const subs = new Set();
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function publish(msg) {
  for (const fn of subs) fn(msg);
}
