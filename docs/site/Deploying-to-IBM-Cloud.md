---
lang: en
title: 'Deploying to IBM Cloud'
keywords: LoopBack
sidebar: lb4_sidebar
permalink: /doc/en/lb4/Deploying-to-IBM-Cloud.html
---

This is a guide for deploying LoopBack 4 (LB4) apps to IBM Cloud. In the setup
explained below, your app will use a local instance of Cloundant when running
locally, and a provisioned Cloudant service when running on the cloud.

Before we begin make sure the following are installed.

1.  [Node.js](https://nodejs.org/en/download/) >= 8.9.0.
2.  [LB4 CLI](https://www.npmjs.com/package/@loopback/cli) (`lb4` command).
3.  [Cloud Foundy CLI](https://docs.cloudfoundry.org/cf-cli/install-go-cli.html).
4.  [Docker](https://www.docker.com/).

Consider the
["todo" example](https://github.com/strongloop/loopback-next/tree/master/examples/todo)
from the [loopback-next repository](https://github.com/strongloop/loopback-next)
as a basis for the instruction.

You can quickly clone the "todo" example app by running the command:

```sh
$ lb4 example todo
```

## Local setup

### Database

1.  [Download Cloudant image](https://hub.docker.com/r/ibmcom/cloudant-developer/).
2.  Ensure port 8080 is free and start Cloudant:

```
docker run \
      --volume cloudant:/srv \
      --name cloudant-developer \
      --publish 8080:80 \
      --hostname cloudant.dev \
      ibmcom/cloudant-developer
```

3.  Log on to the local Cloudant Dashboard using `admin`:`pass` as the
    crendentials.
4.  Create a database named `todo`.

### Updates to the app

#### Updating datasource

Update `db.datasource.json` to use the Cloudant connector.

```js
{
  "name": "db",
  "connector": "cloudant",
  "url": "http://admin:pass@localhost:8080",
  "database": "todo",
  "modelIndex": ""
}
```

Install the `loopback-connector-cloudant` package.

```sh
$ npm i loopback-connector-cloudant -s
```

#### Updating npm script

Remove the `prestart` script from `package.json`, since we don't want to do any
building on the cloud.

#### Updating application

We will use the `cfenv` module to simplify some of the Cloud Foundry related
operations. Install `cfenv` in the project directory.

```sh
$ npm i cfenv -s
```

Update the `index.ts` file to the following to enable service binding.

```ts
import {TodoListApplication} from './application';
import {ApplicationConfig} from '@loopback/core';
const datasourceDb = require('./datasources/db.datasource.json');
const cfenv = require('cfenv');
const appEnv = cfenv.getAppEnv();
if (!appEnv.isLocal) {
  // 'myCloudant' is the name of the provisioned Cloudant service
  datasourceDb = Object.assign({}, datasourceDb, {
    url: appEnv.getServiceURL('myCloudant'),
  });
  app.bind('datasources.config.db').to(datasourceDb);
}

export async function main(options?: ApplicationConfig) {
  // Set the port assigned for the app
  if (!options) options = {};
  if (!options.rest) options.rest = {};

  if (appEnv.isLocal) options.rest.port = options.rest.port;
  else options.rest.port = appEnv.port;

  const app = new TodoListApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  return app;
}
```

## Cloud setup

### Database

1.  Provision a Cloudant database service, and name it `myCloudant`.
2.  Log on to the Cloudant Dashboard and create a database named `todo`.

### Connecting the database to app

Before we can use the provisioned database, we have to connect the database to
an app on Cloud Foundry.

So, create a
[Node.js SDK app](https://console.bluemix.net/catalog/starters/sdk-for-nodejs)
and connect it to the provisioned Cloudant service.

Make a note of the name of the app. Let's say you named it `mylb4app`. We will
be using this name as a placeholder for the unique name you will choose yourself
eventually. Replace `mylb4app` with your app's name in all instances in the doc.

## Deploying the app

### Local

1.  Install all dependencies:

```sh
npm i
```

2.  Build the app:

```sh
npm run build
```

3.  Ensure Cloudant is running locally.
4.  Start the app:

```sh
npm start
```

5.  Go to http://localhost:3000/swagger-ui to load API Explorer and add a todo
    or two.

6.  Go to http://localhost:3000/todos to see the todos.

### Cloud

Before we can deploy to IBM Cloud, we need to create two artifacts.

1.  `.cfignore` - not mandatory, prevents `cf` from uploading the listed files
    to IBM Cloud.
2.  `manifest.yml` - details about the app.

Create a file named `.cfignore` in the app directory with the following content.

```
.git/
node_modules/
vcap-local.js
.vscode/
```

To create the `manifest.yml` file, run `cf create-app-manifest` and specify the
name of the app that was created earlier `mylb4app`.

```sh
$ cf create-app-manifest mylb4app -p manifest.yml
```

Now we are ready to deploy the app to IBM Cloud.

1.  Build the app locally:

```sh
npm run build
```

2.  Push the app to Cloud Foundry:

```
cf push mylb4app
```

3.  Go to https://mylb4app.eu-gb.mybluemix.net/swagger-ui to load the API
    Explorer and add a todo or two. The host `mylb4app.eu-gb.mybluemix.net` is
    derived from the `name` and `domain` values in the `manifest.yml` file.

4.  Go to https://mylb4app.eu-gb.mybluemix.net/todos to see the todos.
