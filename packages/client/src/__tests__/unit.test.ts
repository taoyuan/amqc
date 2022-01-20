import {defer} from '@jil/common/async/defer';
import * as AmqpLib from 'amqplib';
import {cleanup, givenAmqpConnection, nextExchangeName, nextQueueName, rabbit} from './support';
import {Connection} from '../connection';
import {Message} from '../message';
import {Topology} from '../types';

describe('AMQPR Unit Test', () => {
  beforeAll(async () => {
    await rabbit.run();
  }, 60000);

  describe('Connection initialization', () => {
    it('should create a RabbitMQ conn', async () => {
      const conn = givenAmqpConnection();
      await conn.ready();
      await cleanup(conn);
    });
  });

  describe('AMQPR Usage', () => {
    let conn: Connection;

    beforeEach(() => {
      conn = givenAmqpConnection();
    });

    afterEach(async () => {
      await cleanup(conn);
    });

    it('should create a Queue with specified name', async () => {
      const queueName = nextQueueName();
      const queue = conn.declareQueue(queueName);

      await conn.ready();
      expect(queue.name).toEqual(queueName);
    });

    it('should create an Exchange with specified name and type', async () => {
      const exchangeName = nextExchangeName();
      const exchange = conn.declareExchange(exchangeName, 'fanout');

      await conn.ready();
      expect(exchange.name).toEqual(exchangeName);
      expect(exchange.type).toEqual('fanout');
    });

    it('should create a Queue and send and receive a simple text Message', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());

      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual('Test');
            d.resolve(undefined);
          } catch (e) {
            d.reject(e);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      queue.send(new Message('Test'));

      await d;
    });

    it('should create a Queue and send and receive a simple text Message with ack', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());

      await queue.consume(message => {
        try {
          expect(message.getContent()).toEqual('Test');
          message.ack();
          d.resolve();
        } catch (e) {
          d.reject(e);
        }
      });

      await conn.ready();
      queue.send(new Message('Test'));
      await d;
    });

    it('should create a Queue and send and receive a simple text Message with nack', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());
      let nacked = false;

      await queue.consume(message => {
        try {
          expect(message.getContent()).toEqual('Test');
          if (nacked) {
            message.ack();
            d.resolve();
          } else {
            message.nack();
            nacked = true;
          }
        } catch (e) {
          d.reject(e);
        }
      });

      await conn.ready();
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    });

    it('should create not resend a nack(false) message', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());
      let nacked = false;

      await queue.consume(message => {
        try {
          if (nacked) {
            expect(message.getContent()).toEqual('Test Finished');
            message.ack();
            d.resolve();
          } else {
            expect(message.getContent()).toEqual('Test');
            message.nack(false, false);
            nacked = true;
            const msg = new Message('Test Finished');
            queue.send(msg);
          }
        } catch (err) {
          d.reject(err);
        }
      });

      await conn.ready();
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    });

    it('should create a Queue and send and receive a simple text Message with reject', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());

      await queue.consume(message => {
        try {
          expect(message.getContent()).toEqual('Test');
          message.reject(false);
          d.resolve();
        } catch (err) {
          d.reject(err);
        }
      });

      await conn.ready();
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    });

    it('should create a Queue and send and receive a Message with a structure', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());
      const testObj = {
        text: 'Test',
      };

      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual(testObj);
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      const msg = new Message(testObj);
      queue.send(msg);
      await d;
    });

    it('should return the same Queue instance after calling conn.declareQueue multiple times', async () => {
      const queueName = nextQueueName();
      const queue1 = conn.declareQueue(queueName);
      const queue2 = conn.declareQueue(queueName);

      expect(queue1).toBe(queue2);

      await conn.ready();
    });

    it('should return the same Exchange instance after calling conn.declareExchange multiple times', async () => {
      const exchangeName = nextExchangeName();
      const exchange1 = conn.declareExchange(exchangeName);
      const exchange2 = conn.declareExchange(exchangeName);

      expect(exchange1).toBe(exchange2);

      await conn.ready();
    });

    it('should create an Exchange, Queue and binding and send and receive a simple string Message', async () => {
      const d = defer();
      const exchange = conn.declareExchange(nextExchangeName());
      const queue = conn.declareQueue(nextQueueName());
      await queue.bind(exchange);
      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual('Test');
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      const msg = new Message('Test');
      exchange.send(msg);
      await d;
    });

    it('should create an Exchange, Queue and binding and send and receive a Message with structures', async () => {
      const d = defer();
      const exchange = conn.declareExchange(nextExchangeName());
      const queue = conn.declareQueue(nextQueueName());
      const testObj = {
        text: 'Test',
      };

      await queue.bind(exchange);
      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual(testObj);
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      const msg = new Message(testObj);
      exchange.send(msg);
      await d;
    });

    it('should create an Exchange and send and receive a simple string Message', async () => {
      const d = defer();
      const exchange = conn.declareExchange(nextExchangeName());
      await exchange.consume(
        message => {
          try {
            expect(message.getContent()).toEqual('Test');
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      const msg = new Message('Test');
      exchange.send(msg);
      await d;
    });

    it('should bind Exchanges', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());
      const exchange2 = conn.declareExchange(nextExchangeName());
      const queue = conn.declareQueue(nextQueueName());

      await exchange2.bind(exchange1);
      await queue.bind(exchange2);

      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual('Test');
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      const msg = new Message('Test');
      exchange1.send(msg);
      await d;
    });

    it('should reconnect when sending a Message to an Exchange after a broken connection', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());
      const exchange2 = conn.declareExchange(nextExchangeName());
      await exchange2.bind(exchange1);
      const queue = conn.declareQueue(nextQueueName());
      await queue.bind(exchange2);
      await queue
        .consume(
          message => {
            try {
              expect(message.getContent()).toEqual('Test');
              d.resolve();
            } catch (err) {
              d.reject(err);
            }
          },
          {noAck: true},
        )
        .catch(err => {
          console.log('Consumer activation FAILED!!!');
          d.reject(err);
        });

      await conn.ready();
      // break conn
      await conn.client.close();
      // it should auto reconnect and send the message
      const msg = new Message('Test');
      exchange1.send(msg);
      await d;
    });

    it('should reconnect when sending a message to a Queue after a broken conn', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());
      await queue
        .consume(
          message => {
            try {
              expect(message.getContent()).toEqual('Test');
              d.resolve();
            } catch (err) {
              d.reject(err);
            }
          },
          {noAck: true},
        )
        .catch((err: unknown) => {
          console.log('Consumer activation FAILED!!!');
          d.reject(err);
        });

      await conn.ready();
      // break conn
      await conn.client.close();
      // it should auto reconnect and send the message
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    });

    it('should unbind Exchanges and Queues', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());
      const exchange2 = conn.declareExchange(nextExchangeName());
      const queue = conn.declareQueue(nextQueueName());

      await exchange2.bind(exchange1);
      await queue.bind(exchange2);
      await queue.consume(
        async message => {
          try {
            expect(message.getContent()).toEqual('Test');
            await exchange2.unbind(exchange1);
            await queue.unbind(exchange2);
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    });

    it('should close Exchanges and Queues', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());
      const exchange2 = conn.declareExchange(nextExchangeName());
      const queue = conn.declareQueue(nextQueueName());

      await exchange2.bind(exchange1);
      await queue.bind(exchange2);
      await queue.consume(
        async message => {
          try {
            expect(message.getContent()).toEqual('Test');
            await exchange2.delete();
            await queue.delete();
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );

      await conn.ready();
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    });

    it('should not start 2 consumers for the same queue', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());
      const queue = conn.declareQueue(nextQueueName());

      await queue.bind(exchange1);
      await queue.consume(() => {
        d.reject(new Error('Received unexpected message'));
      });
      await expect(
        queue.consume(
          () => {
            d.reject(new Error('Received unexpected message'));
          },
          {noAck: true},
        ),
      ).rejects.toThrow(/Queue.consume error: consumer already defined/);
      d.resolve();
      await d;
    });

    it('should not start 2 consumers for the same exchange', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());

      await exchange1.consume(() => {
        d.reject(new Error('Received unexpected message'));
      });
      await expect(
        exchange1.consume(
          () => {
            d.reject(new Error('Received unexpected message'));
          },
          {noAck: true},
        ),
      ).rejects.toThrow(/Exchange.consume error: consumer already defined/);
      d.resolve();
      await d;
    });

    it('should stop an Exchange consumer', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());

      await exchange1.consume(
        () => {
          d.reject(new Error('Received unexpected message'));
        },
        {noAck: true},
      );
      await exchange1.cancel();
      d.resolve();
      await d;
    });

    it('should not generate an error when canceling a non existing Exchange consumer', async () => {
      const d = defer();
      const exchange1 = conn.declareExchange(nextExchangeName());

      await exchange1.consume(
        () => {
          d.reject(new Error('Received unexpected message'));
        },
        {noAck: true},
      );
      await exchange1.cancel();
      await exchange1.cancel();
      d.resolve();
      await d;
    });

    it('should not generate an error when canceling a non existing Queue consumer', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());

      await queue.consume(
        () => {
          d.reject(new Error('Received unexpected message'));
        },
        {noAck: true},
      );
      await queue.cancel();
      await queue.cancel();
      d.resolve();
      await d;
    });

    it('should send a message to a queue before the queue is explicitly initialized', async () => {
      const d = defer();
      const queue = conn.declareQueue(nextQueueName());
      const msg = new Message('Test');

      queue.send(msg);

      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual('Test');
            d.resolve();
          } catch (err) {
            d.reject(err);
          }
        },
        {noAck: true},
      );
      await d;
    });

    it('should accept optional parameters', async () => {
      const d = defer();
      let messagesReceived = 0;

      const exchange1 = conn.declareExchange(nextExchangeName(), 'topic', {durable: true});
      const exchange2 = conn.declareExchange(nextExchangeName(), 'topic', {durable: true});
      const queue = conn.declareQueue(nextQueueName(), {durable: true});
      await queue.bind(exchange1, '*.*', {});
      await exchange1.bind(exchange2, '*.test', {});

      await conn.ready();
      const msg = new Message('ParameterTest', {});
      exchange2.send(msg, 'topic.test');
      exchange1.send(msg, 'topic.test2');
      queue.send(msg);

      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual('ParameterTest');
            messagesReceived++;
            //expect three messages
            if (messagesReceived === 3) {
              d.resolve();
            }
          } catch (err) {
            d.reject();
          }
        },
        {noAck: true},
      );
      await d;
    });

    it('should close an exchange and a queue', async () => {
      const exchangeName = nextExchangeName();
      const queueName = nextQueueName();

      const exchange = conn.declareExchange(exchangeName);
      let queue = conn.declareQueue(queueName);
      await queue.bind(exchange);

      await conn.ready();
      exchange.send(new Message('InQueueTest'));
      await exchange.close();
      await queue.close();

      queue = conn.declareQueue(queueName);
      const result = await queue.declared;
      expect(result.messageCount).toEqual(1);
    });

    it('should delete an exchange and a queue', async () => {
      const exchangeName = nextExchangeName();
      const queueName = nextQueueName();

      const exchange = conn.declareExchange(exchangeName);
      let queue = conn.declareQueue(queueName);
      await queue.bind(exchange);

      await conn.ready();
      exchange.send(new Message('InQueueTest'));
      await exchange.delete();
      await queue.delete();
      queue = conn.declareQueue(queueName);
      const result = await queue.declared;
      expect(result.messageCount).toEqual(0);
    });

    it('should process a queue rpc', async () => {
      const queue = conn.declareQueue(nextQueueName());

      await queue.consume(message => {
        return message.getContent().reply;
      });

      await conn.ready();
      const result = await queue.rpc({reply: 'TestRpc'});
      expect(result.getContent()).toEqual('TestRpc');
    });

    it('should process an unresolved queue rpc, consumer returning Message', async () => {
      const queue = conn.declareQueue(nextQueueName());

      await queue.consume(message => {
        return new Message(message.getContent().reply);
      });

      const result = await queue.rpc({reply: 'TestRpc'});
      expect(result.getContent()).toEqual('TestRpc');
    });

    it('should process a queue rpc, consumer returning Promise', async () => {
      const queue = conn.declareQueue(nextQueueName());

      await queue.consume(message => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(message.getContent().reply);
          }, 10);
        });
      });

      await conn.ready();
      const result = await queue.rpc({reply: 'TestRpc'});
      expect(result.getContent()).toEqual('TestRpc');
    });

    it('should process an exchange rpc', async () => {
      const exchange = conn.declareExchange(nextExchangeName());

      await exchange.consume(message => {
        return message.getContent().reply;
      });

      await conn.ready();
      const result = await exchange.rpc({reply: 'TestRpc'});
      expect(result.getContent()).toEqual('TestRpc');
    });

    it('should create a topology and send and receive a Message', async () => {
      const d = defer();
      const exchangeName1 = nextExchangeName();
      const exchangeName2 = nextExchangeName();
      const queueName1 = nextQueueName();
      const topology: Topology = {
        exchanges: [{name: exchangeName1}, {name: exchangeName2}],
        queues: [{name: queueName1}],
        bindings: [
          {source: exchangeName1, exchange: exchangeName2},
          {source: exchangeName2, queue: queueName1},
        ],
      };

      await conn.declareTopology(topology);
      const queue = conn.declareQueue(queueName1);
      await queue.consume(
        message => {
          expect(message.getContent()).toEqual('Test');
          d.resolve();
        },
        {noAck: true},
      );

      const exchange = conn.declareExchange(exchangeName1);
      const msg = new Message('Test');
      exchange.send(msg);
      await d;
    });

    it('should close a queue multiple times without generating errors', async () => {
      const queueName = nextQueueName();
      let queue = conn.declareQueue(queueName);

      await conn.ready();
      await queue.close();
      await queue.close();
      // redeclare queue for correct cleanup
      queue = conn.declareQueue(queueName);
      await queue.ready();
    });

    it('should delete a queue multiple times without generating errors', async () => {
      const queueName = nextQueueName();
      const queue = conn.declareQueue(queueName);

      await conn.ready();
      await queue.delete();
      await queue.delete();
    });

    it('should close an exchange multiple times without generating errors', async () => {
      const exchangeName = nextExchangeName();
      let exchange = conn.declareExchange(exchangeName);

      await conn.ready();
      await exchange.close();
      await exchange.close();
      // redeclare exchange for correct cleanup
      exchange = conn.declareExchange(exchangeName);
      await exchange.ready();
    });

    it('should delete an exchange multiple times without generating errors', async () => {
      const exchangeName = nextExchangeName();
      const exchange = conn.declareExchange(exchangeName);

      await conn.ready();
      await exchange.delete();
      await exchange.delete();
    });

    it('should set a prefetch count to a queue', async () => {
      const queueName = nextQueueName();
      const queue = conn.declareQueue(queueName);

      await conn.ready();
      // todo: create a ral test that checks if the function works
      const result = await queue.prefetch(3);
      expect(result).toBeTruthy();
    });

    it('should recover to a queue', async () => {
      const queueName = nextQueueName();
      const queue = conn.declareQueue(queueName);

      await conn.ready();
      // todo: create a real test that checks if the function works
      await queue.recover();
    });

    it("should not connect to a no existing queue with 'noCreate: true'", async () => {
      const queueName = nextQueueName();
      conn.declareQueue(queueName, {noCreate: true});

      // await expect(conn.ready()).rejects.toThrow(/NOT-FOUND/);
      await expect(conn.ready()).rejects.toThrow(/NOT-FOUND/);
    });

    it("should connect to an existing queue with 'noCreate: true'", async () => {
      const queueName = nextQueueName();
      conn.declareQueue(queueName);

      await conn.ready();
      const queue = conn.declareQueue(queueName, {noCreate: true});
      await queue.ready();
    });

    it("should not connect to a no existing exchange with 'noCreate: true'", async () => {
      const exchangeName = nextExchangeName();
      conn.declareExchange(exchangeName, '', {noCreate: true});
      await expect(conn.ready()).rejects.toThrow(/NOT-FOUND/);
    });

    it("should connect to an existing exchange with 'noCreate: true'", async () => {
      const exchangeName = nextExchangeName();
      const c = await AmqpLib.connect(rabbit.url);
      const ch = await c.createChannel();
      await ch.assertExchange(exchangeName, 'fanout');

      const exchange = conn.declareExchange(exchangeName, '', {noCreate: true});
      await exchange.ready();

      await c.close();
    });
  });
});
