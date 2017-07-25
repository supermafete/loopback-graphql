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
    resolve('Not allowed');
  });
  const ACL = modelObject.app.models.ACL;
  const debug = require('debug')('loopback:security:acl');

  debug('[GraphQL] Checking ACLs');

  return new Promise((resolve, reject) => {
    AccessToken.resolve(params.accessToken, (atErr, atRes) => {
      let role = 'everyone';
      if (atErr || !atRes) {
        role = '$unauthenticated';
      } else if (atRes) {
        role = '$authenticated';
      }
      debug('[GraphQL] Using role ' + role);

      resObject.then((data) => {
        const promises = [];
        for (let property in modelObject.definition.properties) {
          if (modelObject.definition.properties.hasOwnProperty(property)) {
            promises.push(
              ACL.checkPermission('ROLE', role, modelObject.definition.name, property, params.accessType,
              (checkPermissionErr, checkPermissionRes) => {
                if (checkPermissionRes.permission === 'DENY') {
                  data[property] = null;
                }
              }),
            );

            Promise.all(promises).then((v) => {
              resolve(new Promise((modifiedResponse) => {
                modifiedResponse(data);
              }));
            });
          }
        }
      });
    });
  });

//   return new Promise((resolve, reject) => {
//     // check permission
//     ACL.checkPermission('ROLE', '$everyone', modelObject.definition.name, '*', 'READ', (e, r) => {
//       // if allow everyone or allow unauthenticated then resolve
//       if (r.permission === 'ALLOW') {
//         const promises = [];
//         resolve(resObject);
//         debug('[GraphQL] Allowed for everyone: ' + modelObject.definition.name);
//
//         resObject.then((data) => {
//           // Iterate over properties to check access.
//           // Probably better if we only iterate over the DENIED properties defined in ACL
//           // but I don't know how to access them... yet.
//           for (const property in modelObject.definition.properties) {
//             if (modelObject.definition.properties.hasOwnProperty(property)) {
//               promises.push(
//                 // bug in loopback/common/models/acl.js(245) 'break left'.
//                 // When accessType is a wildcard, checkPermission is incorrectly resolved.
//                 // This is why I'm setting accessType to READ or WRITE. You can set accessType to
//                 // '*' if you put the break in loopback/common/models/acl.js. Seems that loopback's admin
//                 // needs more time to measure the impact of that break to accept the PR.
//                 // https://github.com/strongloop/loopback/pull/3293
//
//                 // TODO role not hardcoded here please
//                 ACL.checkPermission('ROLE', '$everyone', modelObject.definition.name, property, params.accessType,
//                 (checkPermissionErr, checkPermissionRes) => {
//                   if (checkPermissionRes.permission === 'DENY') {
//                     debug('[GraphQL] Denied access to ' + modelObject.definition.name + '.' + property + ' due to ACL');
//
//                     data[property] = null;
//                     // if (Array.isArray(data)) {
//                     //   data.map((elem) => {
//                     //     elem[property] = [ 'N/A' ];
//                     //   });
//                     // } else {
//                     //   data[property] = 'N/A';
//                     // }
//                   } else {
//                     debug('[GraphQL] Granted access to ' + modelObject.definition.name + '.' + property + ' due to ACL');
//                   }
//                 }),
//               );
//             }
//           }
//
//           Promise.all(promises).then((v) => {
//             resolve(new Promise((modifiedResponse) => {
//               modifiedResponse(data);
//             }));
//           });
//         });
//       } else {
//         const promises = [];
//         debug('[GraphQL] Not allowed for everyone. Checking ACLs.');
//         AccessToken.resolve(params.accessToken, (atErr, atRes) => {
//           const accessTokenObject = atRes;
//           if (!accessTokenObject || atErr) {
//             debug('[GraphQL] No access token received');
//             reject('Invalid access token');
//           } else {
//             debug('[GraphQL] Access token resolved');
//             ACL.checkAccessForToken(accessTokenObject, params.model, params.modelId, params.accessType, (accessErr, accessRes) => {
//               debug('[GraphQL] Check access for token');
//               if (accessErr) {
//                 resolve(notAllowedPromise);
//                 debug('[GraphQL] Access for token denied');
//               } else {
//                 debug('[GraphQL] Doing checks');
//                 resObject.then((data) => {
//                   // Iterate over properties to check access.
//                   // Probably better if we only iterate over the DENIED properties defined in ACL
//                   // but I don't know how to access them... yet.
//                   for (const property in modelObject.definition.properties) {
//                     if (modelObject.definition.properties.hasOwnProperty(property)) {
//                       promises.push(
//                         // bug in loopback/common/models/acl.js(245) 'break left'.
//                         // When accessType is a wildcard, checkPermission is incorrectly resolved.
//                         // This is why I'm setting accessType to READ or WRITE. You can set accessType to
//                         // '*' if you put the break in loopback/common/models/acl.js. Seems that loopback's admin
//                         // needs more time to measure the impact of that break to accept the PR.
//                         // https://github.com/strongloop/loopback/pull/3293
//
//                         // TODO role not hardcoded here please
//                         ACL.checkPermission('ROLE', '$authenticated', modelObject.definition.name, property, params.method,
//                         (checkPermissionErr, checkPermissionRes) => {
//                           if (checkPermissionRes.permission === 'DENY') {
//                             debug('[GraphQL] Denied access to ' + modelObject.definition.name + '.' + property + ' due to ACL');
//
//                             data[property] = null;
//                             // if (Array.isArray(data)) {
//                             //   data.map((elem) => {
//                             //     elem[property] = [ 'N/A' ];
//                             //   });
//                             // } else {
//                             //   data[property] = 'N/A';
//                             // }
//                           } else {
//                             debug('[GraphQL] Granted access to ' + modelObject.definition.name + '.' + property + ' due to ACL');
//                           }
//                         }),
//                       );
//                     }
//                   }
//
//                   Promise.all(promises).then((v) => {
//                     resolve(new Promise((modifiedResponse) => {
//                       modifiedResponse(data);
//                     }));
//                   });
//                 });
//               }
//             });
//           }
//         });
//       }
//
//     // else check access token and resolve
//   });
// });

  // return new Promise((resolve, reject) => {
  //   AccessToken.resolve(params.accessToken, (atErr, atRes) => {
  //     const accessTokenObject = atRes;
  //     if (!accessTokenObject || atErr) {
  //       const promises = [];
  //       debug('[GraphQL] Doing checks');
  //       resObject.then((data) => {
  //         // Iterate over properties to check access.
  //         // Probably better if we only iterate over the DENIED properties defined in ACL
  //         // but I don't know how to access them... yet.
  //         for (const property in modelObject.definition.properties) {
  //           if (modelObject.definition.properties.hasOwnProperty(property)) {
  //             promises.push(
  //               // bug in loopback/common/models/acl.js(245) 'break left'.
  //               // When accessType is a wildcard, checkPermission is incorrectly resolved.
  //               // This is why I'm setting accessType to READ or WRITE. You can set accessType to
  //               // '*' if you put the break in loopback/common/models/acl.js. Seems that loopback's admin
  //               // needs more time to measure the impact of that break to accept the PR.
  //               // https://github.com/strongloop/loopback/pull/3293
  //
  //               // TODO role not hardcoded here please
  //               ACL.checkPermission('ROLE', '$everyone', modelObject.definition.name, property, params.accessType, (e, r) => {
  //                 if (r.permission === 'DENY') {
  //                   debug('[GraphQL] Denied access to ' + modelObject.definition.name + '.' + property + ' due to ACL');
  //
  //                   if (Array.isArray(data)) {
  //                     data.map((elem) => {
  //                       elem[property] = null;
  //                     });
  //                   } else {
  //                     data[property] = null;
  //                   }
  //                 } else {
  //                   // do nothing with data
  //                 }
  //               }),
  //             );
  //           }
  //         }
  //
  //         Promise.all(promises).then((v) => {
  //           resolve(new Promise((modifiedResponse) => {
  //             modifiedResponse(data);
  //           }));
  //         });
  //       });      } else {
  //       debug('[GraphQL] Access token resolved');
  //       const promises = [];
  //       ACL.checkAccessForToken(accessTokenObject, params.model,  params.modelId, params.method, (accessErr, accessRes) => {
  //         debug('[GraphQL] Check access for token');
  //         if (accessErr) {
  //           resolve(notAllowedPromise);
  //           debug('[GraphQL] Access for token denied');
  //         } else {
  //           debug('[GraphQL] Doing checks');
  //           resObject.then((data) => {
  //             // Iterate over properties to check access.
  //             // Probably better if we only iterate over the DENIED properties defined in ACL
  //             // but I don't know how to access them... yet.
  //             for (const property in modelObject.definition.properties) {
  //               if (modelObject.definition.properties.hasOwnProperty(property)) {
  //                 promises.push(
  //                   // bug in loopback/common/models/acl.js(245) 'break left'.
  //                   // When accessType is a wildcard, checkPermission is incorrectly resolved.
  //                   // This is why I'm setting accessType to READ or WRITE. You can set accessType to
  //                   // '*' if you put the break in loopback/common/models/acl.js. Seems that loopback's admin
  //                   // needs more time to measure the impact of that break to accept the PR.
  //                   // https://github.com/strongloop/loopback/pull/3293
  //
  //                   // TODO role not hardcoded here please
  //                   ACL.checkPermission('ROLE', '$authenticated', modelObject.definition.name, property, params.accessType, (e, r) => {
  //                     if (r.permission === 'DENY') {
  //                       debug('[GraphQL] Denied access to ' + modelObject.definition.name + '.' + property + ' due to ACL');
  //
  //                       if (Array.isArray(data)) {
  //                         data.map((elem) => {
  //                           elem[property] = 'N/A';
  //                         });
  //                       } else {
  //                         data[property] = 'N/A';
  //                       }
  //                     } else {
  //                       // do nothing with data
  //                     }
  //                   }),
  //                 );
  //               }
  //             }
  //
  //             Promise.all(promises).then((v) => {
  //               resolve(new Promise((modifiedResponse) => {
  //                 modifiedResponse(data);
  //               }));
  //             });
  //           });
  //         }
  //       });
  //     }
  //   });
  // });
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
