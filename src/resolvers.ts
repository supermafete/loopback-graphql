import * as _ from 'lodash';
import * as utils from './utils';

import * as execution from './execution';
import * as GraphQLJSON from 'graphql-type-json';
import * as GraphQLDate from 'graphql-date';
import {
  CoordinatesScalar,
} from 'graphql-geojson';

const scalarResolvers = {
  JSON: GraphQLJSON,
  Date: GraphQLDate,
  GeoPoint: CoordinatesScalar,
};

function RelationResolver(model) {
  // console.log('RES: RelationResolver:  ', model.modelName);
  let resolver = {};
  _.forEach(utils.sharedRelations(model), rel => {
    // console.log('RES: RelationResolver: sharedRelations: ', model.modelName, rel.type, rel.name);
    resolver[rel.name] = (obj, args, context) => {
      // console.log('RES: RelationResolver Execution: ', rel.name, obj.id, args);
      return execution.findRelated(rel, obj, args, context);
    };
  });

  return {
    [utils.singularModelName(model)]: resolver,
  };
}

function rootResolver(model) {
  return {
    Query: {
      [`${utils.pluralModelName(model)}`]: (root, args, context) => {
        return execution.findAll(model, root, args, context);
      },
      [`${utils.singularModelName(model)}`]: (obj, args, context) => {
        return execution.findOne(model, obj, args, context);
      },
    },
    Mutation: {
      [`update${utils.singularModelName(model)}`]: (obj, args, context) => {
        return execution.upsert(model, args, context);
      },
      [`create${utils.singularModelName(model)}`]: (obj, args, context) => {
        return execution.upsert(model, args, context);
      },
      [`delete${utils.singularModelName(model)}`]: (obj, args, context) => {
        return execution.remove(model, args, context);
      },
    },
  };
}

function searchResolver(model) {
  if (model.definition.settings.elasticSearch) {
    return {
      Query: {
        [`${utils.searchModelName(model)}`]: (obj, args, context) => {
          return execution.search(model, obj, args, context);
        },
      },
    };
  }
}

function throughResolver(model) {
  if (model.definition.settings.modelThrough) {
    return {
      Mutation: {
        [`addTo${utils.singularModelName(model)}`]: (obj, args, context) => {
          return execution.upsert(model, args, context);
        },
        [`removeFrom${utils.singularModelName(model)}`]: (obj, args, context) => {
          // return execution.remove(model, args, context);
          return model.find(args)
            .then(instances => {
              let deletedInstances = instances;
              return instances ? model.destroyAll(args).then(res => deletedInstances) : null;
            });
        },
      },
    };
  }
}

function remoteResolver(model) {
  let mutation = {};
  //model.sharedClass.methods
  if (model.sharedClass && model.sharedClass.methods) {
    model.sharedClass._methods.map(function (method) {
      if (method.accessType !== 'READ' && method.http.path) {
        let acceptingParams = [];
        method.accepts.map(function (param) {
          if (param.arg) {
            acceptingParams.push(param.arg);
          }
        });
        mutation[`${utils.methodName(method, model)}`] = (context, args) => {
          let params = [];
          _.each(method.accepts, (el, i) => {
            params[i] = args[el];
          });
          return model[method.name].apply(model, params);
        };
      }
    });
  }
  return {
    Mutation: mutation,
  };
}

/**
 * Generate resolvers for all models
 *
 * @param {Object} models: All loopback Models
 * @returns {Object} resolvers functions for all models - queries and mutations
 */
export function resolvers(models: any[]) {
  return _.reduce(models, (obj: any, model: any) => {
    if (model.shared) {
      return _.merge(
        obj,
        rootResolver(model),
        searchResolver(model),
        throughResolver(model),
        RelationResolver(model),
        remoteResolver(model),
      );
    }
    return obj;
  }, scalarResolvers);
}
