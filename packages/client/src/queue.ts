/* eslint-disable @typescript-eslint/no-explicit-any */
import * as AmqpLib from 'amqplib';
import {Actor} from './actor';
import {Connection} from './connection';
import {
  QueueConsumeOptions,
  QueueConsumeResult,
  QueueDeclarationOptions,
  QueueDeclareResult,
  QueueDeleteResult,
} from './types';
import {DeclareError} from './errors';
import {assert} from 'tily/assert';
import {Binding} from './binding';
import {Exchange} from './exchange';
import {IncomingMessage, Message} from './message';
import {DIRECT_REPLY_TO_QUEUE} from './consts';

const debug = require('debug')('amqc:client:queue');

export type OnMessage = (msg: IncomingMessage) => any;

export class QueueDeclareError extends DeclareError {}

export class Queue extends Actor {
  channel?: AmqpLib.Channel;
  protected canceling?: boolean;
  protected consumerTag?: string;
  protected consumer?: {
    handler: OnMessage;
    options: QueueConsumeOptions;
  };

  constructor(connection: Connection, id: string, public options: QueueDeclarationOptions = {}) {
    super(connection, id);
    this.attach();
  }

  private _consuming?: Promise<QueueConsumeResult>;

  get consuming(): Promise<QueueConsumeResult> | undefined {
    return this._consuming;
  }

  get declared(): Promise<QueueDeclareResult> {
    return super.declared;
  }

  async ready(waitActivation?: boolean): Promise<void> {
    await super.ready();
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (waitActivation && this.consuming) {
      await this.consuming;
    }
  }

  send(message: Message): void {
    message.sendTo(this);
  }

  async rpc(requestParameters: any): Promise<Message> {
    await this.declared;

    return new Promise((resolve, reject) => {
      assert(this.channel);

      let consumerTag: string;
      this.channel
        .consume(
          DIRECT_REPLY_TO_QUEUE,
          msg => {
            assert(this.channel);
            this.channel.cancel(consumerTag).catch(e => reject(e));

            assert(msg);
            const result = new Message(msg.content, msg.fields);
            result.fields = msg.fields;
            resolve(result);
          },
          {noAck: true},
        )
        .then(
          ok => {
            // send the rpc request
            consumerTag = ok.consumerTag;
            const message = new Message(requestParameters, {replyTo: DIRECT_REPLY_TO_QUEUE});
            message.sendTo(this);
          },
          err => {
            /* istanbul ignore */
            reject(new Error('amqc/client: Queue.rpc error: ' + err.message));
          },
        );
    });
  }

  async prefetch(count: number) {
    await this.ready();
    this.options.prefetch = count;
    return this.channel?.prefetch(count);
  }

  async recover() {
    await this.ready();
    await this.channel?.recover();
  }

  async bind(source: Exchange, pattern = '', args: any = {}): Promise<Binding> {
    assert(this.connection);
    const binding = new Binding(this.connection, this, source, pattern, args);
    await binding.ready();
    return binding;
  }

  async unbind(source: Exchange, pattern = '') {
    assert(this.connection);
    return this.connection.bindings.get(Binding.id(this, source, pattern))?.close();
  }

  /**
   * Start consumer
   *
   * @param handler
   * @param options
   */
  async consume(handler: OnMessage, options: QueueConsumeOptions = {}): Promise<QueueConsumeResult> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this._consuming) {
      throw new Error('amqc Queue.consume error: consumer already defined');
    }
    this.consumer = {handler: handler, options};
    return (this._consuming = this.doConsume());
  }

  /**
   * Cancel consumer
   */
  async cancel(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!this._consuming || this.canceling || !this.consumerTag) {
      return;
    }
    debug('<%s> cancel consumer', this.id);
    this.canceling = true;
    await this._consuming;
    await this.channel?.cancel(this.consumerTag);
    this.canceling = false;

    this._consuming = undefined;
    this.consumerTag = undefined;

    this.consumer = undefined;
  }

  delete(): Promise<QueueDeleteResult> {
    return super.delete();
  }

  protected activate() {
    super.activate();
    if (this.consumer) {
      this._consuming = this.doConsume();
    }
  }

  protected deactivate() {
    super.deactivate();
    this._consuming = undefined;
    this.consumerTag = undefined;
  }

  protected async doConsume(): Promise<QueueConsumeResult> {
    debug('<%s> doActivateConsumer', this.id);
    const consumeWrapper = async (msg: AmqpLib.Message | null) => {
      if (msg == null) {
        // consumer has been canceled
        // TODO to deactivate consumer or here just the deactivating result?
        debug('<%s> received null message', this.id);
        return;
      }

      assert(this.channel);
      assert(this.consumer);
      try {
        const message = new IncomingMessage(this.channel, msg, msg.content, msg.properties);
        message.fields = msg.fields;
        try {
          let result = await this.consumer.handler(message);
          // check if there is a reply-to
          if (msg.properties.replyTo) {
            if (!(result instanceof Message)) {
              result = new Message(result);
            }
            result.properties.correlationId = msg.properties.correlationId;
            this.channel.sendToQueue(msg.properties.replyTo, result.content, result.properties);
          }
        } catch (e) {
          debug(`Queue.onMessage RPC error: ${e.message}`);
        }
      } catch (e) {
        /* istanbul ignore next */
        debug(`Queue.onMessage consumer function returned error: ${e.message}`);
      }
    };

    await this.ready();

    assert(this.channel);
    assert(this.consumer);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const ok = await this.channel.consume(this.name, consumeWrapper, this.consumer.options);
    this.consumerTag = ok.consumerTag;
    return ok;
  }

  protected async doDeclare() {
    assert(this.connection);

    debug('<%s> wait for online', this.id);
    await this.connection.online();

    try {
      debug('<%s> create channel', this.id);
      this.channel = await this.connection.client.createChannel();
    } catch (e) {
      debug('Channel failure, error caused during connection!', e);
      throw new QueueDeclareError(e.message, e);
    }

    try {
      let result: QueueDeclareResult;
      if (this.options.noCreate) {
        debug('<%s> check queue', this.id);
        result = await this.channel.checkQueue(this.name);
      } else {
        debug('<%s> assert queue', this.id);
        result = await this.channel.assertQueue(this.name, this.options);
      }
      if (this.options.prefetch) {
        debug(`<%s> prefetch ${this.options.prefetch}`, this.id);
        await this.channel.prefetch(this.options.prefetch);
      }
      debug('<%s> declare result', this.id, result);
      return result;
    } catch (e) {
      // if (debug.enabled) {
      //   debug(`Failed to create queue '${this.name}'`, e);
      // }
      this.detach();
      throw new QueueDeclareError(e.message, e);
    }
  }

  protected async doClose(del?: boolean): Promise<any> {
    debug('<%s> doClose wait for ready', this.id);
    await this.ready();
    debug('<%s> Binding.removeBindingsContaining', this.id);
    await Binding.removeBindingsContaining(this);
    await this.cancel();
    let result;
    if (del) {
      debug('<%s> deleteQueue', this.id);
      result = await this.channel?.deleteQueue(this.name);
    }
    this.invalidate();
    await this.channel?.close();
    this.dispose();
    return result;
  }
}
