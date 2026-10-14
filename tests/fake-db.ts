// Minimal stand-in for the Drizzle client. Every query chain (select/insert/update/delete)
// resolves to the next queued result when awaited, and its calls are recorded for assertions.
export type Call = { op: string; steps: { method: string; args: unknown[] }[] };

export function createFakeDb() {
  const results: unknown[] = [];
  const calls: Call[] = [];
  const executed: unknown[] = [];

  const chain = (op: string, args: unknown[]) => {
    const call: Call = { op, steps: [{ method: op, args }] };
    calls.push(call);
    let settled: Promise<unknown> | undefined;
    const proxy: any = new Proxy({}, {
      get(_t, key) {
        if (key === "then") {
          settled ??= Promise.resolve(results.length ? results.shift() : []);
          return (res: any, rej: any) => settled!.then(res, rej);
        }
        return (...a: unknown[]) => { call.steps.push({ method: String(key), args: a }); return proxy; };
      },
    });
    return proxy;
  };

  const db: any = {
    select: (...a: unknown[]) => chain("select", a),
    insert: (...a: unknown[]) => chain("insert", a),
    update: (...a: unknown[]) => chain("update", a),
    delete: (...a: unknown[]) => chain("delete", a),
    execute: async (q: unknown) => { executed.push(q); return []; },
    transaction: async (fn: (tx: any) => unknown) => fn(db),
  };

  return {
    db,
    calls,
    executed,
    queue: (...r: unknown[]) => { results.push(...r); },
    reset: () => { results.length = 0; calls.length = 0; executed.length = 0; },
    // Arguments passed to .values() / .set() on the nth chain of a given operation.
    payload: (op: string, n = 0) => calls.filter(c => c.op === op)[n]?.steps.find(s => s.method === "values" || s.method === "set")?.args[0],
  };
}

export const request = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
