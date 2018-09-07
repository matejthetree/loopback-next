// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/openapi-v3
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {SchemaObject} from '@loopback/openapi-v3-types';
import {getFilterJsonSchemaFor} from '@loopback/repository-json-schema';
import {jsonToSchemaObject} from './json-to-schema';

export function getFilterSchemaFor(modelCtor: Function): SchemaObject {
  const jsonSchema = getFilterJsonSchemaFor(modelCtor);
  const schema = jsonToSchemaObject(jsonSchema);
  return schema;
}
