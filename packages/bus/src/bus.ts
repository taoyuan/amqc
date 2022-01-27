import {
  AmqpConnbackOpts,
  AmqpConnectOpts,
  Connection,
  Exchange,
  IncomingMessage,
  isAmqpConnection,
  Message,
  QueueDeclareOptions,
} from '@hamq/client';
import {RouteHandler} from 'routery';
import {AmqpRouter} from './router';

const debug = require('debug')('hamq:bus:bus');

export interface BusOpts {
  exchange?: string;
  queue?: string;
  queueOpts?: QueueDeclareOptions;
  autoAck?: boolean;
}

export const DefaultOptions: Required<BusOpts> = {
  exchange: 'hamq.topic',
  queue: 'queue123',
  queueOpts: {durable: true, autoDelete: false, messageTtl: 30000, expires: 3600000},
  autoAck: false,
};

export class Bus {
  readonly connection: Connection;
  readonly options: Required<BusOpts>;

  readonly exchange: Exchange;

  constructor(connection: Connection, opts?: BusOpts);

  constructor(url: string | AmqpConnectOpts, opts?: BusOpts & AmqpConnbackOpts);

  constructor(urlOrConnection?: string | AmqpConnectOpts | Connection, opts?: BusOpts | AmqpConnbackOpts) {
    if (isAmqpConnection(urlOrConnection)) {
      this.connection = urlOrConnection;
    } else {
      this.connection = new Connection(urlOrConnection, opts as AmqpConnbackOpts);
    }
    this.options = {...DefaultOptions, ...opts};
    this.exchange = this.connection.declareExchange(this.options.exchange, 'topic');
  }

  protected _router: AmqpRouter;

  get router() {
    if (!this._router) {
      this._router = new AmqpRouter();
    }
    return this._router;
  }

  /**
   * Publish content to routingKey
   *
   * @param routingKey
   * @param content
   */
  async publish(routingKey: string, content: Buffer) {
    debug('publish', this.options.queue, this.options.exchange, routingKey);
    this.exchange.send(new Message(content), routingKey);
  }

  /**
   * Subscribe parametric `path` topic. Unsub with `queue.delete()`
   *
   * @param path
   * @param handler
   * @return Queue
   */
  async subscribe(path: string, handler: RouteHandler<IncomingMessage>) {
    debug('subscribe', this.options.queue, this.options.exchange, path);
    const {router} = this;
    const route = router.add(path, handler);
    debug('routingKey', route.topic);

    const queue = this.connection.declareQueue(this.options.queue, this.options.queueOpts);
    await queue.bind(this.exchange, route.topic);

    await queue.consume(async message => {
      debug('received message form queue', this.options.queue);
      await router.handle(message.fields.routingKey, message);
      debug('handled message form queue', this.options.queue);
      if (this.options.autoAck) {
        debug('autoAck', 'true');
        message.ack();
      }
    });

    return queue;
  }

  async end() {
    await this.connection.delete();
    this.connection.end();
  }

  dispose() {
    this.end().catch(console.error);
  }
}
