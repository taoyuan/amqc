import {defer} from '@jil/common/async/defer';
import {timeout} from '@jil/common/async/timeout';
import {cleanup, givenAmqpConnection, TestLongTimeout, rabbit} from './support';
import {Connection} from '../connection';
import {Message} from '../message';

describe('AMQPR Integration Test', () => {
  let conn: Connection;

  beforeAll(async () => {
    await rabbit.run();
  }, 60000);

  beforeEach(() => {
    conn = givenAmqpConnection();
  });

  afterEach(async () => {
    await cleanup(conn);
  });

  it(
    'should reconnect a queue when detecting a broken connection because of a server restart',
    async () => {
      const d = defer();
      const queue = conn.declareQueue('TestQueue');
      await queue.consume(
        message => {
          try {
            expect(message.getContent()).toEqual('Test');
            d.resolve();
          } catch (e) {
            d.reject(e);
          }
        },
        {noAck: true},
      );
      await rabbit.restartApp();
      await timeout(1000);
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    },
    TestLongTimeout,
  );

  it(
    'should reconnect and rebuild all actors when detecting a broken connection because of a server restart',
    async () => {
      const d = defer();
      const exchange1 = conn.declareExchange('TestExchange1');
      const exchange2 = conn.declareExchange('TestExchange2');
      const queue = conn.declareQueue('TestQueue');
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
      await rabbit.restartApp();
      await timeout(1000);
      const msg = new Message('Test');
      queue.send(msg);
      await d;
    },
    TestLongTimeout,
  );
});
