import HttpStatusCodes from "http-status-codes";

import { isJson } from "../../../utils";

import { nameOperationFromContext } from "../utils";

import { OperationHandlerMiddlewareNextFunction } from "./types";
import { RequestContext } from "../../RequestContext";

export async function operationHandlerJsonResponseMiddleware(
  context: RequestContext,
  next: OperationHandlerMiddlewareNextFunction,
) {
  const result = await next();

  if (result === undefined) {
    // Nothing to send.
    return;
  }

  // We are json by default, so always do this, even if the client isnt asking for json.
  // TODO: Might want options to suppress this, although the user should just make another middleware to intercept it.
  // Do this always, even if the client does not ask for json.
  // if (!context.req.header("content-type")?.includes("application/json")) {
  //   return;
  // }

  if (context.res.headersSent) {
    throw new Error(
      `Operation ${nameOperationFromContext(
        context,
      )} handler returned a result but the request has already sent its headers.`,
    );
  }

  if (!isJson(result)) {
    throw new Error(
      `Operation ${nameOperationFromContext(
        context,
      )} handler returned a result that is not JSON serializable.  Are you missing a handler middleware for the response type ${context.res.getHeader(
        "accept",
      )}?`,
    );
  }

  // This could be chained, but unit tests appear to not always make the mocks return itself.
  context.res.status(HttpStatusCodes.OK);
  context.res.setHeader("Content-Type", "application/json");
  context.res.json(result);

  return undefined;
}
