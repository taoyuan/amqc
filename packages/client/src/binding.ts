/* eslint-disable @typescript-eslint/no-explicit-any */

import {assert} from 'tily/assert';
import {Actor} from './actor';
import {Connection} from './connection';
import {Exchange} from './exchange';
import {Queue} from './queue';
import {DeclareError} from './errors';

const debug = require('debug')('hamq:client:binding');

export class BindingDeclareError extends DeclareError {}

export class Binding extends Actor {
  constructor(
    connection: Connection,
    public destination: Exchange | Queue,
    public source: Exchange,
    public pattern = '',
    public args: Record<string, any> = {},
  ) {
    super(connection, Binding.id(destination, source, pattern));
    this.attach();
  }

  static id(destination: Exchange | Queue, source: Exchange, pattern?: string): string {
    return `[${source.name}]->${destination instanceof Queue ? 'Q' : 'E'}[${destination.name}]${pattern ?? ''}`;
  }

  static removeBindingsContaining(connectionPoint: Exchange | Queue): Promise<any> {
    if (debug.enabled) {
      debug('removeBindingsContaining for', connectionPoint.constructor.name, connectionPoint.name);
    }
    assert(connectionPoint.connection);
    const connection = connectionPoint.connection;

    const promises: Promise<void>[] = [];
    connection.bindings.forEach(binding => {
      if (binding && (binding.source === connectionPoint || binding.destination === connectionPoint)) {
        promises.push(binding.close());
      }
    });

    if (debug.enabled) {
      debug('removeBindingsContaining %s bindings', promises.length);
    }
    return Promise.all(promises);
  }

  get declared(): Promise<Binding> {
    return super.declared;
  }

  close() {
    return super.close();
  }

  protected async doDeclare(): Promise<Binding> {
    assert(this.connection);

    if (this.destination instanceof Queue) {
      debug(`create queue binding (${this.source.name} -> ${this.destination.name})`);
      const queue = this.destination;
      await queue.ready();
      assert(queue.channel);
      try {
        await queue.channel.bindQueue(this.destination.name, this.source.name, this.pattern, this.args);
      } catch (e) {
        this.detach();
        throw new BindingDeclareError(
          `Failed to create queue binding (${this.source.name} -> ${this.destination.name})`,
          e,
        );
      }
    } else {
      debug(`create exchange binding (${this.source.name} -> ${this.destination.name})`);
      const exchange = this.destination;
      await exchange.ready();
      try {
        await exchange.channel?.bindExchange(this.destination.name, this.source.name, this.pattern, this.args);
      } catch (e) {
        this.detach();
        throw new BindingDeclareError(
          `Failed to create exchange binding (${this.source.name} -> ${this.destination.name})`,
          e,
        );
      }
    }
    return this;
  }

  protected async doClose() {
    assert(this.connection);

    if (debug.enabled) {
      debug('doClose', {destination: this.destination.name, source: this.source.name});
    }

    if (this.destination instanceof Queue) {
      const queue = this.destination;
      await queue.ready();
      assert(queue.channel);
      await queue.channel.unbindQueue(this.destination.name, this.source.name, this.pattern, this.args);
      this.invalidate();
    } else {
      const exchange = this.destination;
      await exchange.ready();
      await exchange.channel?.unbindExchange(this.destination.name, this.source.name, this.pattern, this.args);
      this.invalidate();
    }
  }
}
