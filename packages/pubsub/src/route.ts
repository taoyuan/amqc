import {IncomingMessage} from '@hamq/client';
import {AmqpTopic, Route, RouteHandler} from 'routery';
import {RouteOptions} from 'routery/src/route';

export type AmqpRouteHandler = RouteHandler<IncomingMessage>;

export class AmqpRoute extends Route {
  constructor(path: string, options?: RouteOptions) {
    super(path, {...AmqpTopic, ...options});
  }
}
