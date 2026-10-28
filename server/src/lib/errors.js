export class HttpError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code || defaultCode(status);
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(message, details) {
    super(422, message, { code: "validation_error", details });
  }
}

function defaultCode(status) {
  return (
    {
      400: "bad_request",
      401: "unauthorized",
      402: "quota_exceeded",
      403: "forbidden",
      404: "not_found",
      409: "conflict",
      413: "payload_too_large",
      422: "validation_error",
      429: "rate_limited",
    }[status] || "internal_error"
  );
}

/** Formats zod issues as `[{ path, message }]`. */
export function zodDetails(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
