// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/explorer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {BindingKey} from '@loopback/context';
import {RequestHandler} from 'express';
import {ApiExplorerUIOptions} from './explorer';

/**
 * Binding keys used by this component.
 */
export namespace ExplorerBindings {
  export const HANDLER = BindingKey.create<RequestHandler>('explorer.handler');

  export const CONFIG = BindingKey.create<ApiExplorerUIOptions | undefined>(
    'explorer.config',
  );
}
