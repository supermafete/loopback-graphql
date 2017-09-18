# GraphQL Server for Loopback (Apollo Server)
### CheckACL variation

Combine the powers of [ApolloStack](http://www.apollostack.com/) GraphQL with the backend of Loopback.
<br>
All of Loopback models are exposed as GraphQL Queries.
<br>
Define models in Loopback to be exposed as REST APIs and GraphQL queries and mutations *.
<br>
Use the Apollo [clients](http://dev.apollodata.com/) to access your data. <br>
<b>NEW:</b> Use Loopback ACL's to check user authentication to access the graphql endpoint and authorization for every document property.

![Loopback Graphql](./resources/loopback-graphql.png?raw=true "LoopBack Apollo Architecture") 

## Getting started

```sh
npm install loopback-graphql-checkacl
```
Add the loopback-graphql component to the `server/component-config.json`: 

```
"loopback-graphql": {
    "path": "/graphql",
    "graphiqlPath":"/graphiql",
    "checkIfAuthenticated": true
  }
```

Requests will be posted to `path` path. (Default: `/graphql`);

Graphiql is available on `graphiqlPath` path. (Default: `/graphiql`);

There's an unresolved bug in loopback that affects the behaviour of loopback-graphql-checkacl: https://github.com/strongloop/loopback/issues/2153

We made a patch for loopback/common/models/acl.js:

(acl.js line 232) Replace:

```
232      if (!req.isWildcard()) {
233        permission = candidate.permission;
234        break;
235      } else {

```

By: 

```
232      if (!req.isWildcard()) {
233        // We should stop from the first match for non-wildcard
234        permission = candidate.permission;
235
236        // Not really. We must find the first permission that matches our request
237        var new_candidate = acls.find((acl) => {
238          return ((acl.principalType === principalType) && (acl.principalId === principalId));
239        });
240        if (new_candidate) {
241          candidate = new_candidate;
242        }
243
244        permission = candidate.permission;
245        break;
246      } else {
```

Add a break in next 'else':

```
      } else {
        if (req.exactlyMatches(candidate)) {
          permission = candidate.permission;
          break;
        }
        // For wildcard match, find the strongest permission
        var candidateOrder = AccessContext.permissionOrder[candidate.permission];
        var permissionOrder = AccessContext.permissionOrder[permission];
        if (candidateOrder > permissionOrder) {
          permission = candidate.permission;
        }
        break; // <<<--------------------
      }
    }
```


## Usage

Access the Graphiql interface to view your GraphQL model onthe Docs section. 
Build the GraphQL queries and use them in your application.

geoPoint objects are supported as follow: 
```
{"newNote": 
  {
    "location": {"lat":40.77492964101182, "lng":-73.90950187151662}
  }
}
```

## How to check authentication
Every request to GraphQL endpoint must have the 'access_token' parameter.

```
http://yourserver/graphql?access_token=dxVEyZfnI6LHmWiqoBucvU2pDlSKh0PGpooanxdx1nFUGIGpsPYhkplZhygnTbAf
```

Look at server/component-config.json for "checkIfAuthenticated" option. What this options do is to check first is the user is correctly authenticated. If not, then GraphQL will raise an error:

```
{
  "error": "Unauthenticated",
  "data": null
}
```

Otherwise GraphQL will continue checking the ACLs for every property of your model. For instance, if you want authenticated users to read Customer's firstName but not Customer's lastName your model ACL will look like this:

```
  "acls": [
    {
      "accessType": "*",
      "principalType": "ROLE",
      "principalId": "$unauthenticated",
      "permission": "DENY"
    },
    {
      "accessType": "*",
      "principalType": "ROLE",
      "principalId": "$authenticated",
      "property": "firstName",
      "permission": "ALLOW"
    }
  ],
```

So, if you are an authenticated user, and you make the query with a valid <b>access_token</b> parameter you will get this:

Query:<br>

```
{
  allCustomers(first: 10) {
    firstName
    lastName
  }
}
```

Result:<br>

```
{
  "data": {
    "allCustomers": [
      {
        "firstName": "1",
        "lastName": "N/A"
      },
      {
        "firstName": "Renate",
        "lastName": "N/A"
      }
    ]
  }
}
```

