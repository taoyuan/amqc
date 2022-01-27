import {Exchange, Queue, QueueDeclareOptions} from '@hamq/client';
import {AmqpRoute, AmqpRouteHandler} from './route';

const debug = require('debug')('hamq:pubsub:subscription');

export interface SubscriptionOpts extends QueueDeclareOptions {
  queue?: string;
  autoAck?: boolean;
}

const DefaultSubscriptionOpts: SubscriptionOpts = {
  queue: 'queue123',
  autoAck: false,
  durable: true,
  autoDelete: false,
  messageTtl: 30000,
  expires: 3600000,
};

export class Subscription {
  readonly opts: SubscriptionOpts;

  protected queue: Queue;

  protected constructor(
    readonly exchange: Exchange,
    readonly path: string,
    readonly handler: AmqpRouteHandler,
    opts?: SubscriptionOpts,
  ) {
    this.opts = {...DefaultSubscriptionOpts, ...opts};
  }

  get connection() {
    return this.exchange.connection;
  }

  static create(exchange: Exchange, path: string, handler: AmqpRouteHandler, opts?: Partial<SubscriptionOpts>) {
    return new Subscription(exchange, path, handler, opts).init();
  }

  async close() {
    await this.queue.delete();
  }

  protected async init(): Promise<Subscription> {
    if (!this.connection) {
      throw new Error('Subscription has been unsubscribed');
    }

    debug('subscribe', this.opts, this.exchange.id, this.path);
    const route = new AmqpRoute(this.path);
    debug('routingKey', route.topic);

    const queue = (this.queue = this.connection.declareQueue(this.opts.queue!, this.opts));
    await queue.bind(this.exchange, route.topic);

    await queue.consume(async message => {
      const {routingKey} = message.fields;
      debug('received message from queue "%s" with routing key "%s"', this.opts.queue, message.fields.routingKey);
      const params = route.match(routingKey);
      if (!params) {
        throw new Error(
          `Received unmatched message. (routingKey = '${routingKey}') is not matching to (path = '${this.path}')`,
        );
      }
      this.handler(params, message);
      debug('handled message from queue "%s" with routing key "%s"', this.opts.queue, message.fields.routingKey);
      if (this.opts.autoAck) {
        debug('autoAck', 'true');
        message.ack();
      }
    });

    return this;
  }
}
