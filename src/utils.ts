import * as _ from 'lodash';

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

function connectionTypeName(model) {
  return `${model.modelName}Connection`;
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
  const AccessToken = modelObject.app.models.AccessToken;
  const notAllowedPromise = new Promise((resolve, reject) => {
    reject('Not allowed');
  });
  const ACL = modelObject.app.models.ACL;

  return new Promise((resolve, reject) => {
    AccessToken.resolve(params.accessToken, (atErr, atRes) => {
      const accessTokenObject = atRes;
      if (!accessTokenObject || atErr) {
        resolve(notAllowedPromise);
      } else {
        const promises = [];
        ACL.checkAccessForToken(accessTokenObject, params.model,  params.modelId, params.method, (accessErr, accessRes) => {
          if (accessErr) {
            resolve(notAllowedPromise);
          } else {
            resObject.then((data) => {
              // Iterate over properties to check access.
              // Probably better if we only iterate over the DENIED properties defined in ACL
              // but I don't know how to access them... yet.
              const debug = require('debug')('loopback:security:acl');
              for (const property in modelObject.definition.properties) {
                if (modelObject.definition.properties.hasOwnProperty(property)) {
                  promises.push(
                    // bug in loopback/common/models/acl.js(245) 'break left'.
                    // When accessType is a wildcard, checkPermission is incorrectly resolved.
                    // This is why I'm setting accessType to READ or WRITE. You can set accessType to
                    // '*' if you put the break in loopback/common/models/acl.js. Seems that loopback's admin
                    // needs more time to measure the impact of that break to accept the PR.
                    // https://github.com/strongloop/loopback/pull/3293

                    // TODO role not hardcoded here please
                    ACL.checkPermission('ROLE', '$authenticated', modelObject.definition.name, property, params.method, (e, r) => {
                      if (r.permission === 'DENY') {
                        debug('[GraphQL] Denied access to ' + modelObject.definition.name + '.' + property + ' due to ACL');

                        if (Array.isArray(data)) {
                          data.map((elem) => {
                            elem[property] = 'N/A';
                          });
                        } else {
                          data[property] = 'N/A';
                        }
                      } else {
                        // do nothing with data
                      }
                    }),
                  );
                }
              }

              Promise.all(promises).then((v) => {
                resolve(new Promise((modifiedResponse) => {
                  modifiedResponse(data);
                }));
              });
            });
          }
        });
      }
    });
  });
}

export {
  PAGINATION,
  getId,
  idToCursor,
  cursorToId,
  connectionTypeName,
  edgeTypeName,
  singularModelName,
  methodName,
  pluralModelName,
  sharedRelations,
  sharedModels,
  checkACL,
};
