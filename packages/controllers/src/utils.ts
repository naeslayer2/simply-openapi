import { PathItemObject } from "openapi3-ts/oas31";
import { JsonValue } from "type-fest";
import { mergeWith } from "lodash";

import { ControllerObject } from "./types";

export const requestMethods = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const satisfies readonly (keyof PathItemObject)[];

export function isJson(x: any): x is JsonValue {
  if (x == null) {
    return true;
  }

  if (Array.isArray(x)) {
    return x.every(isJson);
  }
  if (typeof x === "object") {
    return Object.values(x).every(isJson);
  }

  return (
    typeof x === "string" || typeof x === "number" || typeof x === "boolean"
  );
}

// Javascript throws TypeErrors if we try to access certain properties.
const forbiddenProperties: (string | symbol)[] = [
  "constructor",
  "prototype",
  "caller",
  "callee",
  "arguments",
];
export function getClassMethods(object: object) {
  const methods: Function[] = [];

  function scanObject(obj: object) {
    do {
      for (const propertyName of [
        ...Object.getOwnPropertyNames(obj),
        ...Object.getOwnPropertySymbols(obj),
      ]) {
        if (forbiddenProperties.includes(propertyName)) {
          continue;
        }
        const value = (obj as any)[propertyName];
        if (typeof value === "function") {
          methods.push(value);
        }
      }
    } while ((obj = Object.getPrototypeOf(obj)));
  }

  const prototype = (object as any).prototype;
  if (prototype && prototype.constructor === object) {
    // This is a class constructor
    scanObject(prototype);
  } else if (object.constructor) {
    // This is an instance
    scanObject(object);
  } else {
    // No idea what this is
    scanObject(Object);
  }

  return methods;
}

/**
 * Scans through both prototypes (for functions for constructors) and the object prototype stack (for live instances)
 */
export function scanObjectChain(
  obj: object,
  scanner: (instance: object) => boolean | void,
) {
  function scanFrom(
    obj: object,
    getPrototype: (obj: object) => object | null | undefined,
  ) {
    let currentObj: object | null | undefined = obj;
    do {
      if (scanner(currentObj) === false) {
        return false;
      }
    } while ((currentObj = getPrototype(currentObj)));
    return true;
  }

  if (scanner(obj) === false) {
    return;
  }

  if (!scanFrom(obj, Object.getPrototypeOf)) {
    return;
  }

  scanFrom(obj, (obj: any) => obj.prototype);
}

export function scanObjectProperties(
  obj: object,
  scanner: (
    instance: object,
    key: string | symbol,
    value: any,
  ) => boolean | void,
) {
  scanObjectChain(obj, (obj) => {
    for (const propertyName of [
      ...Object.getOwnPropertyNames(obj),
      ...Object.getOwnPropertySymbols(obj),
    ]) {
      if (forbiddenProperties.includes(propertyName)) {
        continue;
      }
      const value = (obj as any)[propertyName];
      if (scanner(obj, propertyName, value) === false) {
        return false;
      }
    }
  });
}

export function nameController(controller: ControllerObject) {
  return (controller as any).name ?? controller.constructor.name;
}

export function isNotNullOrUndefined<T>(x: T | null | undefined): x is T {
  return x !== null;
}

export function isConstructor(object: object): boolean {
  const prototype = (object as any).prototype;
  return prototype && prototype.constructor === object;
}

export function mergeCombineArrays(object: any, ...sources: any[]) {
  for (const source of sources) {
    object = mergeWith(object, source, (objValue, srcValue): any => {
      if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    });
  }

  return object;
}
