import * as _ from 'lodash';

import {
  getId,
  idToCursor,
  checkACL,
} from './utils';

function buildSelector(model, args) {
  let selector = {
    where: args.filter || {},
    skip: undefined,
    limit: undefined,
    order: undefined,
  };
  const begin = getId(args.after);
  const end = getId(args.before);
  const orderBy = (args.orderBy) ? args.orderBy.replace('_DESC', ' DESC').replace('_ASC', ' ASC') : null;

  // selector.skip = args.first - args.last || 0;
  selector.skip = args.skip || 0;
  selector.limit = args.last || args.first;
  selector.order =  orderBy || (model.getIdName() + (end ? ' DESC' : ' ASC'));
  if (begin) {
    selector.where[model.getIdName()] = selector[model.getIdName()] || {};
    selector.where[model.getIdName()].gt = begin;
  }
  if (end) {
    selector.where[model.getIdName()] = selector[model.getIdName()] || {};
    selector.where[model.getIdName()].lt = end;
  }
  console.log("EXEC: buildSelector: selector", model.modelName, selector);
  return selector;
}

function findOne(model, obj, args, context) {
  const accessToken = context.query.access_token;
  let id = obj ? obj[model.getIdName()] : args.id;
  console.log("EXEC: findOne: modelName and id: ", model.modelName, id);
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
  console.log("EXEC: getFirst", model.modelName, args);
  return model.findOne({
    order: model.getIdName() + (args.before ? ' DESC' : ' ASC'),
    where: args.where,
  })
    .then(res => {
      return res ? res.__data : {};
    });
}

function getList(model, obj, args, context) {
  console.log("EXEC: getList: ", model.modelName, args);
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
  console.log("EXEC: upsert: ", model.modelName, args, context);
  // BUG: Context is undefined
  return model.upsert(args.obj);
  // const accessToken = context.query.access_token;
  // return checkACL({
  //   accessToken: accessToken,
  //   model: model.definition.name,
  //   modelId: '',
  //   method: '*',
  //   accessType: 'WRITE',
  // }, model, model.upsert(args.obj));
}

function findAll(model: any, obj: any, args: any, context: any) {
  console.log("findAll", model.modelName, args);
  return getList(model, obj, args, context);
}

function findRelated(rel, obj, args: any = {}, context) {
  console.log('EXEC: findRelated: REL:', rel.modelFrom.modelName, rel.keyFrom, rel.type, rel.modelTo.modelName, rel.keyTo, args);
  args.where = {
    [rel.keyTo]: obj[rel.keyFrom],
  };
  if (rel.type === 'hasOne') {
    // rel.modelFrom[rel.modelTo.modelName]((err, res) => console.log('rel resulr', err, res));
    return getFirst(rel.modelTo, obj, args, context);
  }
  if (rel.type === 'belongsTo') {
    console.log("OBJ:", obj);
    args.id = obj[rel.keyFrom];
    // rel.modelFrom[rel.modelTo.modelName]((err, res) => console.log('rel resulr', err, res));
    return findOne(rel.modelTo, null, args, context);
  }
  if (rel.type === 'hasMany') {
    findAll(rel.modelTo, obj, args, context).then(list => {
      console.log("EXEC: findRelated: list: ", list);
      return list;
    });
    // return findAll(rel.modelTo, obj, args, context);
  }
  // if (_.isArray(obj[rel.keyFrom])) {
  //   return [];
  // }
  // args.where = {
  //   [rel.keyTo]: obj[rel.keyFrom],
  // };
  // return findAll(rel.modelTo, obj, args, context);
}

export {
  findAll,
  findOne,
  findRelated,
  upsert,
};
