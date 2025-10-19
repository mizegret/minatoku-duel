type Subscriber = (msg: unknown) => void;

const subs = new Set<Subscriber>();

export function subscribe(fn: Subscriber): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function publish(msg: unknown): void {
  for (const fn of subs) fn(msg);
}
