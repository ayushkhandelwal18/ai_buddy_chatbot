import { ApiError } from "../utils/api-error.js";
import { logServiceError } from "../utils/service-error.js";

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * Central error handler — keeps the API response shape consistent
 * ({ message, errors? }) across every route.
 */
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    // Streaming already started — we can only close the connection.
    return res.end();
  }

  let status = err.status || err.statusCode || 500;
  let message = err.message || "Something went wrong";
  let errors = err.details;

  if (err.name === "ValidationError") {
    status = 422;
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(", ");
  } else if (err.name === "CastError") {
    status = 400;
    message = "Invalid identifier";
  } else if (err.code === 11000) {
    status = 409;
    message = "Resource already exists";
  }

  if (status >= 500) {
    if (err.cause) logServiceError("request", err);
    else console.error("[error]", err);
  }

  return res.status(status).json({
    message,
    ...(errors ? { errors } : {}),
  });
};
