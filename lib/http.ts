// Shared request parsing, validation, and error handling for the API functions.

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const error = (status: number, message: string) => json({ error: message }, status);

// Wraps a handler so thrown HttpErrors and database errors become JSON responses
// instead of unhandled 500/502s.
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e: any) {
      if (e instanceof HttpError) return error(e.status, e.message);
      const code = e?.code ?? e?.cause?.code;
      if (code === "23505") return error(409, "A record with that key already exists");
      if (code === "23503") return error(400, "Referenced patient or physician does not exist");
      console.error(e);
      return error(500, "Internal server error");
    }
  };
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function parseId(value: string | null | undefined, field = "id"): number {
  if (value == null || value === "") throw new HttpError(400, `${field} is required`);
  if (!/^\d+$/.test(String(value))) throw new HttpError(400, `${field} must be a positive integer`);
  const n = Number(value);
  if (n <= 0 || n > 2147483647) throw new HttpError(400, `${field} must be a positive integer`);
  return n;
}

export function optionalId(value: unknown, field: string): number | null {
  if (value == null || value === "") return null;
  return parseId(String(value), field);
}

export function requiredText(value: unknown, field: string, max = 200): string {
  const s = optionalText(value, field, max);
  if (!s) throw new HttpError(400, `${field} is required`);
  return s;
}

export function optionalText(value: unknown, field: string, max = 200): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a string`);
  const s = value.trim();
  if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return s;
}

export function optionalDate(value: unknown, field: string): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a date string`);
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new HttpError(400, `${field} is not a valid date`);
  return d;
}

// Only the last four digits ever leave the server.
export function maskSsn(ssn: string | null | undefined): string {
  if (!ssn) return "";
  const digits = ssn.replace(/\D/g, "");
  return digits.length >= 4 ? `***-**-${digits.slice(-4)}` : "";
}
