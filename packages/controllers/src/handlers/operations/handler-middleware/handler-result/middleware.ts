import { nameOperationFromContext } from "../../utils";

import { OperationHandlerMiddlewareNextFunction } from "../types";
import { RequestContext } from "../../../RequestContext";

import { HandlerResult } from "./HandlerResult";

export async function operationHandlerResponseObjectMiddleware(
  context: RequestContext,
  next: OperationHandlerMiddlewareNextFunction,
) {
  const result = await next();

  if (!(result instanceof HandlerResult)) {
    return result;
  }

  if (context.res.headersSent) {
    throw new Error(
      `Operation ${nameOperationFromContext(
        context,
      )} handler returned a result but the request has already sent its headers.`,
    );
  }

  result._apply(context.res);
  return undefined;
}
