import { Container } from '@cloudflare/containers';

export class MainAppContainer extends Container {
  // must match the port your Express app listens on
  defaultPort = 8787;
}

export default {
  async fetch(request, env) {
    const id = env.MAIN_APP_CONTAINER.idFromName('main-app');
    const container = env.MAIN_APP_CONTAINER.get(id);
    return container.fetch(request);
  }
};