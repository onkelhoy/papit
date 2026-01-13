export class HttpError extends Error {
  status!: number;

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "http-error";
  }
}

export class InternalServerError extends HttpError {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "internal server error", options);

    this.name = "Internal Server Error";
    this.status = 500;
  }
}

export class NotFoundError extends HttpError {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "not found", options);

    this.name = "Not Found";
    this.status = 404;
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "method not allowed", options);

    this.name = "Method not allowed";
    this.status = 405;
  }
}

