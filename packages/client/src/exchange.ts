/* eslint-disable @typescript-eslint/no-explicit-any */

import os from 'os';
import {Channel} from 'amqplib';
import uniqid from 'uniqid';
import {assert} from 'tily/assert';
import {Inflight} from '@jil/inflight';
import {Connection} from './connection';
import {Actor} from './actor';
import {ExchangeDeclareOptions, ExchangeDeclareResult, QueueConsumeOptions} from './types';
import {DeclareError} from './errors';
import {Binding} from './binding';
import {Message} from './message';
import {APP_NAME, DIRECT_REPLY_TO_QUEUE} from './consts';
import {OnMessage} from './queue';

const debug = require('debug')('amqc:client:exchange');

export class ExchangeDeclareError extends DeclareError {}

export class Exchange extends Actor {
  channel?: Channel;

  protected rpcTag?: string;
  protected rpcInflight?: Inflight<string>;

  constructor(
    connection: Connection,
    name: string,
    public type: string = 'direct',
    public options: ExchangeDeclareOptions = {},
  ) {
    super(connection, name);
    this.attach();
  }

  get declared(): Promise<ExchangeDeclareResult> {
    return super.declared;
  }

  dispose() {
    super.dispose();
    this.rpcInflight?.stop();
    this.rpcInflight?.clear();

    delete this.rpcInflight;

    delete this.channel;
  }

  send(message: Message, routingKey = ''): void {
    message.sendTo(this, routingKey);
  }

  async rpc(requestParameters: any, routingKey = ''): Promise<Message> {
    if (!this.rpcInflight) {
      await this.setupRpc();
    }
    assert(this.rpcInflight);
    const request = this.rpcInflight.acquire<Message>();
    const message = new Message(requestParameters, {correlationId: request.id, replyTo: DIRECT_REPLY_TO_QUEUE});
    message.sendTo(this, routingKey);
    return request.promise;
  }

  async bind(source: Exchange, pattern = '', args: any = {}): Promise<Binding> {
    assert(this.connection);
    const binding = new Binding(this.connection, this, source, pattern, args);
    await binding.ready();
    return binding;
  }

  async unbind(source: Exchange, pattern = ''): Promise<void> {
    assert(this.connection);
    return this.connection.bindings.get(Binding.id(this, source, pattern))?.close();
  }

  consumerQueueName(): string {
    return this.name + '.' + APP_NAME + '.' + os.hostname() + '.' + process.pid;
  }

  consume(onMessage: OnMessage, options?: QueueConsumeOptions): Promise<any> {
    assert(this.connection);
    const queueName = this.consumerQueueName();
    if (this.connection.queues.has(queueName)) {
      return new Promise<void>((_, reject) => {
        reject(new Error('amqc Exchange.consume error: consumer already defined'));
      });
    } else {
      const promises: Promise<any>[] = [];
      const queue = this.connection.declareQueue(queueName, {durable: false});
      promises.push(queue.ready());
      const binding = queue.bind(this);
      promises.push(binding);
      const consumer = queue.consume(onMessage, options);
      promises.push(consumer);

      return Promise.all(promises);
    }
  }

  async cancel(): Promise<any> {
    assert(this.connection);
    const queue = this.connection.queues.get(this.consumerQueueName());
    if (queue) {
      return queue.close(true);
    }
  }

  protected async doDeclare(): Promise<ExchangeDeclareResult> {
    debug('<%s> doDeclare begin', this.id);
    assert(this.connection);

    debug('<%s> doDeclare - wait for connection online', this.id);
    await this.connection.online();
    try {
      debug('<%s> doDeclare - create channel', this.id);
      this.channel = await this.connection.client.createChannel();
    } catch (e) {
      debug('Channel failure, error caused during connection!', e);
      throw new ExchangeDeclareError(e.message, e);
    }

    try {
      let result: ExchangeDeclareResult;
      if (this.options.noCreate) {
        debug('<%s> doDeclare - check exchange', this.id);
        await this.channel.checkExchange(this.name);
        result = {exchange: this.name};
      } else {
        debug('<%s> doDeclare - assert exchange', this.id);
        result = await this.channel.assertExchange(this.name, this.type, this.options);
      }
      return result;
    } catch (e) {
      debug(`<%s> doDeclare - Failed to create exchange '${this.name}'`, this.id, e);
      this.connection.exchanges.remove(this);
      throw new ExchangeDeclareError(e.message, e);
    }
  }

  protected async doClose(del?: boolean): Promise<void> {
    assert(this.connection);

    if (this.declaring) {
      await this.declared;
    }

    await this.ready();

    if (this.rpcTag) {
      await this.channel?.cancel(this.rpcTag);
      delete this.rpcTag;
    }

    await Binding.removeBindingsContaining(this);
    if (del) {
      await this.channel?.deleteExchange(this.name, {});
    }

    this.invalidate();
    await this.channel?.close();

    // dispose if close successful
    this.dispose();
  }

  protected async setupRpc() {
    if (!this.rpcInflight) {
      assert(this.channel);

      this.rpcInflight = new Inflight<string>({idgen: uniqid});

      const ok = await this.channel.consume(
        DIRECT_REPLY_TO_QUEUE,
        msg => {
          if (!msg) return;

          const result = new Message(msg.content, msg.fields);
          result.fields = msg.fields;
          this.rpcInflight?.resolve(msg.properties.correlationId, result);
        },
        {noAck: true},
      );

      this.rpcTag = ok.consumerTag;
    }
  }
}
