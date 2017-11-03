import * as _ from 'lodash';
import * as graphQLCore from 'graphql-server-core';

const PAGINATION = '(where: JSON, after: String, first: Int, before: String, last: Int)';

function base64(i) {
  return (new Buffer(i, 'ascii')).toString('base64');
}

function unbase64(i) {
  return (new Buffer(i, 'base64')).toString('ascii');
}

const PREFIX = 'connection.';

/**
 * Creates the cursor string from an offset.
 * @param {String} id the id to convert
 * @returns {String}   an opaque cursor
 */
function idToCursor(id) {
  return base64(PREFIX + id);
}

/**
 * Rederives the offset from the cursor string.
 * @param {String} cursor   the cursor for conversion
 * @returns {String} id   converted id
 */
function cursorToId(cursor) {
  return unbase64(cursor).substring(PREFIX.length);
}

function getId(cursor) {
  if (cursor === undefined || cursor === null) {
    return null;
  }
  return cursorToId(cursor);
}

function edgeTypeName(model: any) {
  return `${model.modelName}Edge`; // e.g. UserEdge
}

function singularModelName(model) {
  return model.modelName;
}

function pluralModelName(model: any) {
  return 'all' + _.upperFirst(model.pluralModelName);
}

function searchModelName(model: any) {
  return 'search' + _.upperFirst(model.pluralModelName);
}

function sharedRelations(model: any) {
  return _.pickBy(model.relations, rel => rel.modelTo && rel.modelTo.shared);
}

function sharedModels(models: any[]) {
  return _.filter(models, model => {
    return model.shared;
  });
}

function methodName(method, model) {
  return model.modelName + _.upperFirst(method.name);
}

function checkACL(params, modelObject, resObject) {
  const loopback = require('loopback');

  const AccessToken = modelObject.app.models.AccessToken;
  const Role = loopback.getModel('Role');
  const notAllowedPromise = new Promise((resolve, reject) => {
    resolve('Not allowed');
  });
  const ACL = modelObject.app.models.ACL;
  const debug = require('debug')('loopback:security:acl');

  debug('[GraphQL] Checking ACLs');

  return new Promise((resolve, reject) => {
    AccessToken.resolve(params.accessToken, (atErr, atRes) => {
      let role = 'everyone';
      let userId = "0";
      if (atErr || !atRes) {
        role = '$unauthenticated';
      } else if (atRes) {
        role = '$authenticated';
        userId = atRes.userId;
      }

      Role.isInRole('admin', {principalType: 'USER', principalId: userId }, (err, isInRole) => {
        role = (isInRole) ? 'admin' : role;
        console.log("ROLEW", role);

        resObject.then((data) => {
          console.log('DATA', data ? data.id : 'no id');
          const promises = [];

          promises.push(
            ACL.checkPermission('ROLE', role, modelObject.definition.name, '*', params.accessType,
            (checkPermissionErr, checkPermissionRes) => {
              // debug('[GraphQL] Permission for ' + modelObject.definition.name + '.' + property + ' is ' + checkPermissionRes.permission + ' for role ' + role);
              if (checkPermissionRes.permission === 'DENY') {
                data = null;
              }
            }),
          );

          Promise.all(promises).then((v) => {
            resolve(new Promise((modifiedResponse) => {
              modifiedResponse(data);
            }));
          });

          // for (let property in modelObject.definition.properties) {
          //   if (modelObject.definition.properties.hasOwnProperty(property)) {
          //
          //   }
          // }
        });
      });
    });
  });
}

// overwrite of expressApollo.js from 'graphql-server-express' graphqlExpress function
function graphqlExpressIfAuthenticated(app, gqlOptions) {
    if (!gqlOptions) {
        throw new Error('Apollo Server requires options.');
    }
    if (arguments.length !== 2) {
        throw new Error("graphqlExpressIfAuthenticated expects exactly two arguments, got " + arguments.length);
    }
    return function (req, res) {
        graphQLCore.runHttpQuery([req, res], {
            method: req.method,
            options: gqlOptions,
            query: req.method === 'POST' ? req.body : req.query,
        }).then(function (gqlResponse) {
            const accessToken = app.models.AccessToken;
            console.log("GQL", req.query);
            accessToken.resolve(req.query.access_token, (atErr, atRes) => {
              res.setHeader('Content-Type', 'application/json');
              if (atErr || !atRes) {
                res.status(401).send({
                  error: "Unauthenticated",
                  message: "You need to be authenticated to access this resource",
                }).end();
              } else if (atRes) {
                res.write(gqlResponse);
                res.end();
              }
            });
        }, function (error) {
            if ('HttpQueryError' !== error.name) {
                throw error;
            }
            if (error.headers) {
                Object.keys(error.headers).forEach(function (header) {
                    res.setHeader(header, error.headers[header]);
                });
            }
            res.statusCode = error.statusCode;
            res.write(error.message);
            res.end();
        });
    };
}

export {
  PAGINATION,
  getId,
  idToCursor,
  cursorToId,
  edgeTypeName,
  singularModelName,
  methodName,
  pluralModelName,
  sharedRelations,
  sharedModels,
  searchModelName,
  checkACL,
  graphqlExpressIfAuthenticated,
};
