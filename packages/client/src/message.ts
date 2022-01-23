/* eslint-disable @typescript-eslint/no-explicit-any */

import * as AmqpLib from 'amqplib';
import {assert} from 'tily/assert';
import {Event} from '@jil/common/event';
import {Exchange} from './exchange';
import {Queue} from './queue';
import {MessageFields, MessageProperties} from './types';

const debug = require('debug')('hamq:client:message');

export class Message {
  content: Buffer;
  properties: Partial<MessageProperties>;

  constructor(content?: any, properties?: Partial<MessageProperties>) {
    this.properties = properties ?? {};
    if (content !== undefined) {
      this.setContent(content);
    }
  }

  setContent(content: any): void {
    if (Buffer.isBuffer(content)) {
      this.content = content;
    } else if (typeof content === 'string') {
      this.content = Buffer.from(content);
    } else {
      this.content = Buffer.from(JSON.stringify(content));
      this.properties.contentType = 'application/json';
    }
  }

  getContent(): any {
    let content = this.content.toString();
    if (this.properties.contentType === 'application/json') {
      content = JSON.parse(content);
    }
    return content;
  }

  sendTo(destination: Exchange | Queue, routingKey = ''): void {
    // inline function to send the message
    const sendMessage = () => {
      assert(destination.connection);
      assert(destination.channel);
      try {
        destination.channel.publish(exchange, routingKey, this.content, this.properties);
      } catch (err) {
        debug(`Publish error: ${err.message}`);
        const destinationName = destination.name;
        const connection = destination.connection;

        debug(`Try to reset connection, before Call.`);
        connection.reconnect();

        Event.once(connection.onconnect)(() => {
          debug('Retransmitting message');
          if (destination instanceof Queue) {
            // connection.queues.get(destinationName)?.publish(this.content, this.properties);
            connection.queues.get(destinationName)?.send(this);
          } else {
            // connection.exchanges.get(destinationName)?.publish(this.content, routingKey, this.properties);
            connection.exchanges.get(destinationName)?.send(this);
          }
        });
      }
    };

    let exchange = '';
    if (destination instanceof Queue) {
      routingKey = destination.name;
    } else {
      exchange = destination.name;
    }

    // execute sync when possible
    destination
      .ready()
      .then(sendMessage)
      .catch(e => destination.connection?.feedError(e));
  }
}

export class IncomingMessage extends Message {
  readonly content: Buffer;
  readonly fields: MessageFields;
  readonly properties: MessageProperties;

  constructor(readonly channel: AmqpLib.Channel, readonly message: AmqpLib.Message) {
    super(message.content, message.properties);
    this.fields = message.fields;
  }

  ack(allUpTo?: boolean): void {
    this.channel.ack(this.message, allUpTo);
  }

  nack(allUpTo?: boolean, requeue?: boolean): void {
    this.channel.nack(this.message, allUpTo, requeue);
  }

  reject(requeue = false): void {
    this.channel.reject(this.message, requeue);
  }
}
