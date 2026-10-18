import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Unhandled API Error:", err);

  if (res.headersSent) { _next(err); return; }
  const statusCode = err.code === "P2023" || err.code === "P2000" ? 400
    : err.code === "LIMIT_FILE_SIZE" ? 413
    : err.code === "P2025" ? 404
    : err.statusCode || err.status || 500;
  const message = statusCode >= 500 ? "The service is temporarily unavailable. Please try again."
    : statusCode === 400 && err.code ? "The request contains an invalid value." : err.message || "Request failed";

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
