// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/repository-json-schema
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Model, model} from '@loopback/repository';
import {JSONSchema6 as JsonSchema} from 'json-schema';

@model({settings: {strict: false}})
class EmptyModel extends Model {}

const scopeFilter = getFilterJsonSchemaFor(EmptyModel);

/**
 * Build a JSON schema describing the format of the "filter" object
 * used to query model instances.
 *
 * Note we don't take the model properties into account yet and return
 * a generic json schema allowing any "where" condition.
 *
 * @param modelCtor The model constructor to build the filter schema for.
 */
export function getFilterJsonSchemaFor(modelCtor: Function): JsonSchema {
  const schema: JsonSchema = {
    properties: {
      where: {
        type: 'object',
        // TODO(bajtos) enumberate "model" properties and operators like "and"
        additionalProperties: true,
      },

      fields: {
        type: 'object',
        // TODO(bajtos) enumberate "model" properties
        additionalProperties: true,
      },

      offset: {
        type: 'integer',
        minimum: 0,
      },

      limit: {
        type: 'integer',
        minimum: 0,
      },

      skip: {
        type: 'integer',
        minimum: 0,
      },

      order: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
  };

  // TODO(bajtos) Rework this condition to check whether "model has any
  // relations defined
  if (modelCtor !== EmptyModel) {
    schema.properties!.include = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          // TODO(bajtos) restrict values to relations defined by "model"
          relation: {type: 'string'},
          // TODO(bajtos) describe the filter for the relation target model
          scope: scopeFilter,
        },
      },
    };
  }

  return schema;
}
