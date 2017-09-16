import { graphqlExpress, graphiqlExpress } from 'graphql-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import * as bodyParser from 'body-parser';

import { abstractTypes } from './ast';
import { resolvers } from './resolvers';
import { generateTypeDefs } from './typedefs';

export function boot(app, options) {
  const models = app.models();
  let types = abstractTypes(models);
  let schema = makeExecutableSchema({
    typeDefs: generateTypeDefs(types),
    resolvers: resolvers(models),
    resolverValidationOptions: {
      requireResolversForAllFields: false,
    },
  });

  let graphiqlPath = options.graphiqlPath || '/graphiql';
  let path = options.path || '/graphql';

  // overwrite of expressApollo.js from 'graphql-server-express' graphqlExpress function
  let graphQLCore = require("graphql-server-core");
  function graphqlExpress2(gqlOptions) {
      if (!gqlOptions) {
          throw new Error('Apollo Server requires options.');
      }
      if (arguments.length > 1) {
          throw new Error("Apollo Server expects exactly one argument, got " + arguments.length);
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
                  res.write("unauthenticated");
                } else if (atRes) {
                  res.write(gqlResponse);
                }
                res.end();
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

  app.use(path, bodyParser.json(), graphqlExpress2((req) => {
    return {
      schema,
      context: req,
    };
  }));

  app.use(graphiqlPath, graphiqlExpress({
    endpointURL: path,
  }));
}
