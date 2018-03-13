import * as _ from 'lodash';

import {
  getId,
  idToCursor,
  checkACL,
  canUserMutate,
} from './utils';

function buildSelector(model, args) {
  let selector = {
      where: JSON.parse(JSON.stringify(args.filter)) || JSON.parse(JSON.stringify(args.where)) || {},
      skip: undefined,
      limit: undefined,
      order: undefined,
  };
  const begin = getId(args.after);
  const end = getId(args.before);
  // const orderBy = (args.orderBy) ? args.orderBy.replace('_DESC', ' DESC').replace('_ASC', ' ASC') : null;
  let orderBy = null;
  if (args.orderBy) {
    try {
      orderBy = JSON.parse(args.orderBy);
    } catch (error) {
      orderBy = args.orderBy.replace('_DESC', ' DESC').replace('_ASC', ' ASC');
    }
  }

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
  return selector;
}

function findOne(model, obj, args, context) {
  const accessToken = context.query.access_token;
  let id = obj ? obj[model.getIdName()] : args.id;
  if (!id) {
    return null;
  } else {
    return checkACL({
      accessToken: accessToken,
      model: model.definition.name,
      modelId: id,
      method: '',
      accessType: 'READ',
    }, model, model.findById(id));
  }
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
  let params = {
    accessToken: context.query.access_token,
    accessType: "WRITE"
  }

  return new Promise((resolve, reject) => {
    canUserMutate(params, model)
      .then((r) => {
        // BUG: Context is undefined
        if (model.definition.settings.modelThrough) {
          model.upsertWithWhere(args, args).then((document) => {
            resolve(document);
          });
        } else {
          return model.upsert(args.obj).then((document) => {
            resolve(document);
          });
        }
      })
      .catch((e) => {
        reject(e);
      });
  });

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
  return getList(model, obj, args, context);
}

function findRelated(rel, obj, args: any = {}, context) {
  args.where = {
    [rel.keyTo]: obj[rel.keyFrom],
  };
  if (rel.type === 'hasOne') {
    // rel.modelFrom[rel.modelTo.modelName]((err, res) => console.log('rel resulr', err, res));
    return getFirst(rel.modelTo, obj, args, context);
  }
  if (rel.type === 'belongsTo') {
    args.id = obj[rel.keyFrom];
    // rel.modelFrom[rel.modelTo.modelName]((err, res) => console.log('rel resulr', err, res));
    return findOne(rel.modelTo, null, args, context);
  }
  if (rel.type === 'hasMany') {
    let mod = new rel.modelFrom(obj);
    return mod[rel.name]({}); //findAll(rel.modelTo, obj, args, context);
  }
  // if (_.isArray(obj[rel.keyFrom])) {
  //   return [];
  // }
  // args.where = {
  //   [rel.keyTo]: obj[rel.keyFrom],
  // };
  // return findAll(rel.modelTo, obj, args, context);
}

function remove(model, args, context) {
  const accessToken = context.query.access_token;
  let params = {
    accessToken: context.query.access_token,
    accessType: "WRITE"
  }

  return new Promise((resolve, reject) => {
    canUserMutate(params, model)
      .then((r) => {
        model.destroyById(args.id, (err) => {
          console.log("ERR", err);
          if (err) {
            reject(err);
          } else {
            console.log("ARGS", args);
            resolve(args);
          }
        });
      })
      .catch((e) => {
        reject(e);
       });
    });
}

function search(model: any, obj: any, args: any, context: any) {
  // was: return getList(model, obj, args, context);
  // to be: return model.search(args.searchTerm);
  return model.search(args, context);
}

export {
  findAll,
  findOne,
  findRelated,
  search,
  upsert,
  remove,
};
