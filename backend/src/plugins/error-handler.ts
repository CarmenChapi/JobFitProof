import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

const clientErrors: Record<number, { error: string; message: string }> = {
  400: { error: "BadRequest", message: "The request is invalid" },
  401: { error: "Unauthorised", message: "Authentication is required" },
  403: { error: "Forbidden", message: "The request is not allowed" },
  404: { error: "NotFound", message: "The requested resource was not found" },
  408: { error: "RequestTimeout", message: "The request took too long" },
  413: { error: "PayloadTooLarge", message: "The request body is too large" },
  414: { error: "UriTooLong", message: "The request URL is too long" },
  415: { error: "UnsupportedMediaType", message: "The request content type is not supported" },
  429: { error: "RateLimitExceeded", message: "The request limit has been reached" }
};

export function sendPublicError(reply: FastifyReply, statusCode: number) {
  const body = statusCode >= 500
    ? { error: "InternalServerError", message: "The server could not complete the request" }
    : clientErrors[statusCode] ?? { error: "RequestError", message: "The request could not be processed" };

  return reply
    .status(statusCode)
    .type("application/json")
    .header("cache-control", "no-store")
    .header("x-request-id", reply.request.id)
    .send({ ...body, requestId: reply.request.id });
}

export function handleApiError(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const statusCode = Number.isInteger(error.statusCode) && error.statusCode! >= 400 && error.statusCode! <= 599
    ? error.statusCode!
    : 500;

  if (statusCode >= 500) {
    request.log.error({ err: error }, "Request failed");
  } else {
    // Parser messages can contain fragments of a CV or other submitted data.
    request.log.info({ statusCode }, "Request rejected");
  }
  return sendPublicError(reply, statusCode);
}
