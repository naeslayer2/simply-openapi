import { ParameterObject } from "openapi3-ts/oas31";
import { NotFound, BadRequest } from "http-errors";
import { capitalize } from "lodash";
import { ValidationError } from "ajv";

import { resolveReference } from "../../../schema-utils";
import { errorToMessage } from "../../../ajv";

import { RequestContext } from "../../RequestContext";

import { nameOperationFromContext } from "../utils";
import {
  OperationHandlerMiddlewareFactory,
  OperationHandlerMiddlewareNextFunction,
  ValueProcessorFunction,
} from "./types";
import { OperationMiddlewareFactoryContext } from "./OperationMiddlewareFactoryContext";

export const parametersProcessorMiddlewareFactory: OperationHandlerMiddlewareFactory =
  (ctx) => {
    const processors = collectParameterProcessors(ctx);
    return (
      reqCtx: RequestContext,
      next: OperationHandlerMiddlewareNextFunction,
    ) => {
      processParameters(reqCtx, processors);
      return next();
    };
  };

function collectParameterProcessors(ctx: OperationMiddlewareFactoryContext) {
  const parameters = ctx.parameters;

  const compileParamSchema = (param: ParameterObject) => {
    if (!param.schema) {
      return (value: any) => value;
    }

    const resolved = resolveReference(ctx.spec, param.schema);
    if (!resolved) {
      throw new Error(
        `Could not resolve parameter schema reference for parameter ${
          param.name
        } in operation ${nameOperationFromContext(ctx)}.`,
      );
    }

    try {
      return ctx.compileSchema(resolved);
    } catch (e: any) {
      e.message = `Failed to compile schema for parameter ${param.in} ${param.name}: ${e.message}`;
      throw e;
    }
  };

  const processors = parameters.reduce(
    (acc, param) => {
      const processor = compileParamSchema(param);
      acc[param.name] = processor;
      return acc;
    },
    {} as Record<string, ValueProcessorFunction>,
  );

  return processors;
}

function processParameters(
  ctx: RequestContext,
  processors: Record<string, ValueProcessorFunction>,
) {
  for (const param of ctx.parameters) {
    const processor = processors[param.name];

    const rawValue = getParameterValue(ctx, param);
    if (rawValue === undefined) {
      throwIfRequired(param);
      ctx.setRequestData(`openapi-parameter-${param.name}`, undefined);
      continue;
    }

    let value: any;
    try {
      value = processor(rawValue);
    } catch (e: any) {
      if (e instanceof ValidationError) {
        if (param.in === "path") {
          throw new NotFound();
        }

        throw new BadRequest(
          `${capitalize(param.in)} parameter "${
            param.name
          }" is invalid: ${errorToMessage(e)}`,
        );
      }
    }

    ctx.setRequestData(`openapi-parameter-${param.name}`, value);
  }
}

function getParameterValue(ctx: RequestContext, param: ParameterObject) {
  switch (param.in) {
    case "path":
      return ctx.getPathParam(param.name);
    case "query":
      return ctx.getQuery(param.name);
    case "cookie":
      return ctx.getCookie(param.name);
    case "header":
      return ctx.getHeader(param.name);
    default:
      throw new Error(`Unsupported parameter location: ${param.in}`);
  }
}

function throwIfRequired(param: ParameterObject) {
  if (!param.required && param.in !== "path") {
    return;
  }

  if (param.in === "path") {
    throw new NotFound();
  } else {
    throw new BadRequest(
      `${capitalize(param.in)} parameter "${param.name}" is required.`,
    );
  }
}
