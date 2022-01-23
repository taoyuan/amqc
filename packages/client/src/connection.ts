/* eslint-disable @typescript-eslint/no-explicit-any */

import {Event} from '@jil/common/event';
import {AmqpConnback, AmqpConnbackOpts, AmqpConnection, AmqpConnectOpts} from '@connback/amqp';
import {ExchangeDeclareOptions, QueueDeclareOptions, Topology} from './types';
import {Exchange} from './exchange';
import {Queue} from './queue';
import {Binding} from './binding';
import {Actors} from './actors';
import {Actor} from './actor';

const debug = require('debug')('hamq:client:connection');

export {AmqpConnectOpts, AmqpConnbackOpts};

export class Connection extends AmqpConnback {
  readonly exchanges = new Actors<Exchange>();
  readonly queues = new Actors<Queue>();
  readonly bindings = new Actors<Binding>();

  protected _ready?: Promise<unknown>;
  private readonly url: string | AmqpConnectOpts;

  constructor(url: string | AmqpConnectOpts = 'amqp://localhost', options?: AmqpConnbackOpts) {
    super(url, options);
    this.url = url;
    this.onclose(() => {
      debug('connection closed');
      this.resetReady();
    });
  }

  get connection(): AmqpConnection {
    return this.client;
  }

  async online() {
    if (!this.connected) {
      await Event.toPromise(this.onconnect);
    }
  }

  resetReady() {
    debug('reset "ready"');
    this._ready = undefined;
  }

  async ready() {
    await this.online();

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!this._ready) {
      this._ready = Promise.all([
        ...[...this.exchanges.values()].map(item => item.ready()),
        ...[...this.queues.values()].map(item => item.ready(true)),
        ...[...this.bindings.values()].map(item => item.ready()),
      ]);
    }

    await this._ready;
  }

  /**
   * Un-declare the whole defined connection topology:
   * return promise that fulfills after all defined exchanges, queues and bindings have been removed
   */
  async delete() {
    debug('close');
    await Promise.all([
      ...[...this.bindings.values()].map(item => item.delete()),
      ...[...this.queues.values()].map(item => item.delete()),
      ...[...this.exchanges.values()].map(item => item.delete()),
    ]);
  }

  forActors<T extends Actor>(actor: T): Actors<T> {
    if (actor instanceof Exchange) {
      return this.exchanges as any;
    } else if (actor instanceof Queue) {
      return this.queues as any;
    } else if (actor instanceof Binding) {
      return this.bindings as any;
    } else {
      throw new Error(`Unsupported actor ${actor.constructor.name}`);
    }
  }

  declareExchange(name: string, type?: string, options?: ExchangeDeclareOptions): Exchange {
    debug('declare exchange', {name, type, options});
    let exchange = this.exchanges.get(name);
    if (!exchange) {
      exchange = new Exchange(this, name, type, options);
    }
    return exchange;
  }

  declareQueue(name: string, options?: QueueDeclareOptions): Queue {
    debug('declare queue', {name, options});
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(this, name, options);
    }
    return queue;
  }

  declareTopology(topology: Topology): Promise<any> {
    debug('declare topology', topology);
    const promises: Promise<any>[] = [];
    let i: number;
    let len: number;

    if (topology.exchanges) {
      for (i = 0, len = topology.exchanges.length; i < len; i++) {
        const exchange = topology.exchanges[i];
        promises.push(this.declareExchange(exchange.name, exchange.type, exchange.options).ready());
      }
    }
    if (topology.queues) {
      for (i = 0, len = topology.queues.length; i < len; i++) {
        const queue = topology.queues[i];
        promises.push(this.declareQueue(queue.name, queue.options).ready());
      }
    }
    if (topology.bindings) {
      for (i = 0, len = topology.bindings.length; i < len; i++) {
        const binding = topology.bindings[i];
        const source = this.declareExchange(binding.source);
        let destination: Queue | Exchange;
        if (binding.exchange) {
          destination = this.declareExchange(binding.exchange);
        } else if (binding.queue) {
          destination = this.declareQueue(binding.queue);
        } else {
          // ignore invalid topology
          continue;
        }
        promises.push(destination.bind(source, binding.pattern, binding.args));
      }
    }
    return Promise.all(promises);
  }
}

export function isAmqpConnection(x: any): x is Connection {
  return (
    x &&
    typeof x.declareExchange === 'function' &&
    typeof x.declareQueue === 'function' &&
    typeof x.declareTopology === 'function'
  );
}
