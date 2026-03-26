import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[Error] ${err.message}`);

  const code = (err as any).code;

  if (code === "CONFLICT") {
    return c.json({ error: err.message, code: "CONFLICT" }, 409);
  }

  return c.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    500
  );
};
