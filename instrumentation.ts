import type { Instrumentation } from "next";
import {
  createRequestId,
  logEvent,
  safeRequestPath,
  serializeError,
} from "@/lib/observability";

export function register() {
  logEvent("info", "server.started", { runtime: process.env.NEXT_RUNTIME || "nodejs" });
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const incomingRequestId = request.headers["x-request-id"];
  const requestId = createRequestId(Array.isArray(incomingRequestId) ? incomingRequestId[0] : incomingRequestId);

  logEvent("error", "server.request_failed", {
    request_id: requestId,
    method: request.method,
    path: safeRequestPath(request.path),
    route: context.routePath,
    route_type: context.routeType,
    router: context.routerKind,
    ...serializeError(error),
  });
};
