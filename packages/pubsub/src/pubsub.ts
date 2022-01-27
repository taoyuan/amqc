import {AmqpConnbackOpts, AmqpConnectOpts, Connection, Exchange, isAmqpConnection, Message} from '@hamq/client';
import {AmqpRouteHandler} from './route';
import {Subscription, SubscriptionOpts} from './subscription';

const debug = require('debug')('hamq:pubsub:pubsub');

export interface PubSubOpts {
  exchange?: string;
  subscription?: Partial<SubscriptionOpts>;
}

export const DefaultOptions: Required<PubSubOpts> = {
  exchange: 'hamq.topic',
  subscription: {}, // default is defined in Subscription
};

export class PubSub {
  readonly connection: Connection;
  readonly options: Required<PubSubOpts>;

  readonly exchange: Exchange;

  constructor(connection: Connection, opts?: PubSubOpts);

  constructor(url: string | AmqpConnectOpts, opts?: PubSubOpts & AmqpConnbackOpts);

  constructor(urlOrConnection?: string | AmqpConnectOpts | Connection, opts?: PubSubOpts | AmqpConnbackOpts) {
    if (isAmqpConnection(urlOrConnection)) {
      this.connection = urlOrConnection;
    } else {
      this.connection = new Connection(urlOrConnection, opts as AmqpConnbackOpts);
    }
    this.options = {...DefaultOptions, ...opts};
    this.exchange = this.connection.declareExchange(this.options.exchange, 'topic');
  }

  /**
   * Publish content to routingKey
   *
   * @param routingKey
   * @param content
   */
  async publish(routingKey: string, content: Buffer) {
    debug('publish %s -> %s', this.options.exchange, routingKey);
    this.exchange.send(new Message(content), routingKey);
  }

  /**
   * Subscribe parametric `path` topic. Unsub with `queue.delete()`
   *
   */
  async subscribe(path: string, handler: AmqpRouteHandler): Promise<Subscription>;
  async subscribe(path: string, opts: SubscriptionOpts, handler: AmqpRouteHandler): Promise<Subscription>;
  async subscribe(
    path: string,
    opts: SubscriptionOpts | AmqpRouteHandler,
    handler?: AmqpRouteHandler,
  ): Promise<Subscription> {
    if (typeof opts === 'function') {
      handler = opts;
      opts = {};
    }
    opts = {...this.options.subscription, ...opts};
    debug('subscribe', opts.queue, this.options.exchange, path);
    return Subscription.create(this.exchange, path, handler!, opts);
  }

  async end() {
    await this.connection.delete();
    this.connection.end();
  }

  dispose() {
    this.end().catch(console.error);
  }
}
