import * as _ from 'lodash';

import {
  getId,
  connectionTypeName,
  idToCursor,
  checkACL,
} from './utils';

function buildSelector(model, args) {
  let selector = {
    where: args.where || {},
    skip: undefined,
    limit: undefined,
    order: undefined,
  };
  const begin = getId(args.after);
  const end = getId(args.before);

  selector.skip = args.first - args.last || 0;
  selector.limit = args.last || args.first;
  selector.order = model.getIdName() + (end ? ' DESC' : ' ASC');
  if (begin) {
    selector.where[model.getIdName()] = selector[model.getIdName()] || {};
    selector.where[model.getIdName()].gt = begin;
  }
  if (end) {
    selector.where[model.getIdName()] = selector[model.getIdName()] || {};
    selector.where[model.getIdName()].lt = end;
  }
  return selector;
}

function findOne(model, obj, args, context) {
  const accessToken = context.query.access_token;
  let id = obj ? obj[model.getIdName()] : args.id;

  return checkACL({
    accessToken: accessToken,
    model: model.definition.name,
    modelId: id,
    method: '',
    accessType: 'READ',
  }, model, model.findById(id));
}

function getCount(model, obj, args, context) {
  return model.count(args.where);
}

function getFirst(model, obj, args, context) {
  return model.findOne({
    order: model.getIdName() + (args.before ? ' DESC' : ' ASC'),
    where: args.where,
  })
    .then(res => {
      return res ? res.__data : {};
    });
}

function getList(model, obj, args, context) {
  const accessToken = context.query.access_token;
  return checkACL({
    accessToken: accessToken,
    model: model.definition.name,
    modelId: '',
    method: '',
    accessType: 'READ',
  }, model, model.find(buildSelector(model, args)));
}

function upsert(model, args, context) {
  const accessToken = context.query.access_token;
  return checkACL({
    accessToken: accessToken,
    model: model.definition.name,
    modelId: '',
    method: '*',
    accessType: 'WRITE',
  }, model, model.upsert(args.obj));
}

function findAll(model: any, obj: any, args: any, context: any) {
  const response = {
    args: args,
    count: undefined,
    first: undefined,
    list: undefined,
  };
  return getCount(model, obj, args, context)
    .then(count => {
      response.count = count;
      return getFirst(model, obj, args, context);
    })
    .then(first => {
      response.first = first;
      return getList(model, obj, args, context);
    })
    .then(list => {
      response.list = list;
      return response.list;
    });
}

function findRelated(rel, obj, args, context) {
  if (rel.type === 'hasOne') {
    args.id = obj[rel.keyTo];
    return findOne(rel.modelTo, null, args, context);
  }
  if (rel.type === 'hasMany') {
    const keyTo = rel.keyTo;
    const id = obj.id;
    args.where = {};
    args.where[keyTo] = id;

    return findAll(rel.modelTo, obj, args, context);
  }
  if (_.isArray(obj[rel.keyFrom])) {
    return [];
  }
  args.where = {
    [rel.keyTo]: obj[rel.keyFrom],
  };
  return findAll(rel.modelTo, obj, args, context);
}


function resolveConnection(model) {
  return {
    [connectionTypeName(model)]: {
      totalCount: (obj, args, context) => {
        return obj.count;
      },

      edges: (obj, args, context) => {
        return _.map(obj.list, node => {
          return {
            cursor: idToCursor(node[model.getIdName()]),
            node: node,
          };
        });
      },

      [model.pluralModelName]: (obj, args, context) => {
        return obj.list;
      },

      pageInfo: (obj, args, context) => {
        let pageInfo = {
          startCursor: null,
          endCursor: null,
          hasPreviousPage: false,
          hasNextPage: false,
        };
        if (obj.count > 0) {
          pageInfo.startCursor = idToCursor(obj.list[0][model.getIdName()]);
          pageInfo.endCursor = idToCursor(obj.list[obj.list.length - 1][model.getIdName()]);
          pageInfo.hasNextPage = obj.list.length === obj.args.limit;
          pageInfo.hasPreviousPage = obj.list[0][model.getIdName()] !== obj.first[model.getIdName()].toString();
        }
        return pageInfo;
      },
    },
  };
}

export {
  findAll,
  findOne,
  findRelated,
  resolveConnection,
  upsert,
};
