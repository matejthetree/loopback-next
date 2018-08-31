// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/explorer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {inject, Setter, Provider} from '@loopback/context';
import {Component, ProviderMap} from '@loopback/core';
import {ApiExplorerUIOptions, apiExplorerUI} from './explorer';
import {Handler} from 'express';
import {ExplorerBindings} from './keys';

export class ExplorerProvider implements Provider<Handler> {
  constructor(
    @inject(ExplorerBindings.CONFIG, {optional: true})
    private config: ApiExplorerUIOptions,
  ) {}

  value() {
    return apiExplorerUI(this.config);
  }
}

export class ExplorerComponent implements Component {
  providers?: ProviderMap;
  constructor() {
    this.providers = {
      [ExplorerBindings.HANDLER.key]: ExplorerProvider,
    };
  }
}
