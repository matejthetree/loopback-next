// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  OpenApiSpec,
  OperationObject,
  ParameterObject,
} from '@loopback/openapi-spec';
import {Context, Constructor, instantiateClass} from '@loopback/context';
import {ServerRequest} from 'http';
import * as HttpErrors from 'http-errors';

import {
  ParsedRequest,
  PathParameterValues,
  OperationArgs,
  OperationRetval,
} from '../internal-types';

import * as assert from 'assert';
import * as url from 'url';
const debug = require('debug')('loopback:core:routing-table');

// TODO(bajtos) Refactor this code to use Trie-based lookup,
// e.g. via wayfarer/trie or find-my-way
// See https://github.com/strongloop/loopback-next/issues/98
import * as pathToRegexp from 'path-to-regexp';

/**
 * Parse the URL of the incoming request and set additional properties
 * on this request object:
 *  - `path`
 *  - `query`
 *
 * @private
 * @param request
 */
export function parseRequestUrl(request: ServerRequest): ParsedRequest {
  // TODO(bajtos) The following parsing can be skipped when the router
  // is mounted on an express app
  const parsedRequest = request as ParsedRequest;
  const parsedUrl = url.parse(parsedRequest.url, true);
  parsedRequest.path = parsedUrl.pathname || '/';
  parsedRequest.query = parsedUrl.query;
  return parsedRequest;
}

// tslint:disable-next-line:no-any
export type ControllerClass = Constructor<any>;

export class RoutingTable {
  private readonly _routes: RouteEntry[] = [];

  registerController(controller: ControllerClass, spec: OpenApiSpec) {
    assert(
      typeof spec === 'object' && !!spec,
      'API specification must be a non-null object',
    );
    if (!spec.paths || !Object.keys(spec.paths).length) {
      return;
    }

    debug('Registering Controller with API', spec);

    for (const path in spec.paths) {
      for (const verb in spec.paths[path]) {
        const opSpec: OperationObject = spec.paths[path][verb];
        const route = new ControllerRoute(verb, path, opSpec, controller);
        this.registerRoute(route);
      }
    }
  }

  registerRoute(route: RouteEntry) {
    // TODO(bajtos) handle the case where opSpec.parameters contains $ref
    // See https://github.com/strongloop/loopback-next/issues/435
    debug(
      'Registering route %s %s -> %s(%s)',
      route.verb,
      route.path,
      route.describe(),
      describeOperationParameters(route.spec),
    );
    this._routes.push(route);
  }

  find(request: ParsedRequest): ResolvedRoute {
    for (const entry of this._routes) {
      const match = entry.match(request);
      if (match) return match;
    }

    throw new HttpErrors.NotFound(
      `Endpoint "${request.method} ${request.path}" not found.`,
    );
  }
}

export interface RouteEntry {
  readonly verb: string;
  readonly path: string;
  readonly spec: OperationObject;

  match(request: ParsedRequest): ResolvedRoute | undefined;

  updateBindings(requestContext: Context): void;
  invokeHandler(
    requestContext: Context,
    args: OperationArgs,
  ): Promise<OperationRetval>;

  describe(): string;
}

export interface ResolvedRoute extends RouteEntry {
  readonly pathParams: PathParameterValues;
}

export abstract class BaseRoute implements RouteEntry {
  public readonly verb: string;
  private readonly _pathRegexp: pathToRegexp.PathRegExp;

  constructor(
    verb: string,
    public readonly path: string,
    public readonly spec: OperationObject,
  ) {
    this.verb = verb.toLowerCase();

    // In Swagger, path parameters are wrapped in `{}`.
    // In Express.js, path parameters are prefixed with `:`
    path = path.replace(/{([^}]*)}(\/|$)/g, ':$1$2');
    this._pathRegexp = pathToRegexp(path, [], {strict: false, end: true});
  }

  match(request: ParsedRequest): ResolvedRoute | undefined {
    debug('trying endpoint', this);
    if (this.verb !== request.method!.toLowerCase()) {
      debug(' -> verb mismatch');
      return undefined;
    }

    const match = this._pathRegexp.exec(request.path);
    if (!match) {
      debug(' -> path mismatch');
      return undefined;
    }

    const pathParams = this._buildPathParams(match);
    debug(' -> found with params: %j', pathParams);

    return createResolvedRoute(this, pathParams);
  }

  abstract updateBindings(requestContext: Context): void;

  abstract invokeHandler(
    requestContext: Context,
    args: OperationArgs,
  ): Promise<OperationRetval>;

  describe(): string {
    return `"${this.verb} ${this.path}"`;
  }

  private _buildPathParams(pathMatch: RegExpExecArray): PathParameterValues {
    const pathParams = Object.create(null);
    for (const ix in this._pathRegexp.keys) {
      const key = this._pathRegexp.keys[ix];
      const matchIndex = +ix + 1;
      pathParams[key.name] = pathMatch[matchIndex];
    }
    return pathParams;
  }
}

export function createResolvedRoute(
  route: RouteEntry,
  pathParams: PathParameterValues,
): ResolvedRoute {
  return Object.create(route, {
    pathParams: {
      writable: false,
      value: pathParams,
    },
  });
}

export class Route extends BaseRoute {
  constructor(
    verb: string,
    path: string,
    public readonly spec: OperationObject,
    protected readonly _handler: Function,
  ) {
    super(verb, path, spec);
  }

  describe(): string {
    return this._handler.name || super.describe();
  }

  updateBindings(requestContext: Context) {
    // no-op
  }

  async invokeHandler(
    requestContext: Context,
    args: OperationArgs,
  ): Promise<OperationRetval> {
    return await this._handler(...args);
  }
}

type ControllerInstance = {[opName: string]: Function};

export class ControllerRoute extends BaseRoute {
  protected readonly _methodName: string;

  constructor(
    verb: string,
    path: string,
    spec: OperationObject,
    protected readonly _controllerCtor: ControllerClass,
    methodName?: string,
  ) {
    super(verb, path, spec);

    if (!methodName) {
      methodName = this.spec['x-operation-name'];
    }

    if (!methodName) {
      throw new Error(
        'methodName must be provided either via the ControllerRoute argument ' +
        'or via "x-operation-name" extension field in OpenAPI spec. ' +
        `Operation: "${verb} ${path}" ` +
        `Controller: ${this._controllerCtor.name}.`);
    }

    this._methodName = methodName;
  }

  describe(): string {
    return `${this._controllerCtor.name}.${this._methodName}`;
  }

  updateBindings(requestContext: Context) {
    const ctor = this._controllerCtor;
    requestContext.bind('controller.current.ctor').to(ctor);
    requestContext.bind('controller.current.operation').to(this._methodName);
  }

  async invokeHandler(
    requestContext: Context,
    args: OperationArgs,
  ): Promise<OperationRetval> {
    const controller = await this._createControllerInstance(requestContext);
    return await controller[this._methodName](...args);
  }

  private async _createControllerInstance(
    requestContext: Context,
  ): Promise<ControllerInstance> {
    const valueOrPromise = instantiateClass(
      this._controllerCtor,
      requestContext,
    );
    return await Promise.resolve(valueOrPromise) as ControllerInstance;
  }
}

function describeOperationParameters(opSpec: OperationObject) {
  return ((opSpec.parameters as ParameterObject[]) || [])
      .map(p => p.name)
      .join(', ');
}