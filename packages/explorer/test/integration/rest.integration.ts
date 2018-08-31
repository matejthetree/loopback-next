// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/explorer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
import {createClientForHandler} from '@loopback/testlab';
import {RestServerConfig, RestComponent, RestServer} from '@loopback/rest';
import {Application} from '@loopback/core';
import {ExplorerComponent, ExplorerBindings} from '../..';

describe('API Explorer for REST Server', () => {
  let server: RestServer;

  before(async () => {
    server = await givenAServer({
      rest: {},
    });

    // FIXME: How do we configure the API Explorer UI?
    server.bind(ExplorerBindings.CONFIG).to({});

    // FIXME: Should the ExplorerComponent contribute a handler or route?
    const handler = await server.get(ExplorerBindings.HANDLER);

    // FIXME: How to register routes to the rest server by phase or order
    // FIXME: Should REST server automatically mounts the route based on registration
    // via bindings such as `rest.server.routes`?
    server.staticRouter.use('/explorer', handler);
  });

  it('exposes "GET /explorer"', async () => {
    await createClientForHandler(server.requestHandler)
      .get('/explorer')
      .expect(200, /\<title\>LoopBack API Explorer<\/title\>/)
      .expect('content-type', /text\/html.*/);
  });
});

async function givenAServer(options?: {rest: RestServerConfig}) {
  const app = new Application(options);
  app.component(RestComponent);
  // FIXME: Can we mount the ExplorerComponent to a given server?
  app.component(ExplorerComponent);
  const server = await app.getServer(RestServer);
  return server;
}
