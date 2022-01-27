import {defer} from '@jil/common/async/defer';
import {timeout} from '@jil/common/async/timeout';
import {Rabbit} from '@hamq/testlab';
import {givenPubSub, rabbit} from './support';

describe('PubSub', () => {
  beforeAll(async () => {
    await rabbit.run();
  }, Rabbit.Timeout);

  it('should subscribe and publish', async () => {
    const sample = Buffer.from('Hello World!');
    const d = defer();
    const pubsub = givenPubSub();
    const subscription = await pubsub.subscribe('$foo.:id', (params, message) => {
      expect(params).toEqual({id: 'bar'});
      expect(message.content).toEqual(sample);
      d.resolve();
    });
    expect(subscription).toBeTruthy();
    await pubsub.publish('$foo.bar', sample);
    await timeout(500);
    await pubsub.end();
    await d;
  });

  it('should not be confused between `foo` and `foo.reply`', async () => {
    const d = defer();
    const pubsub = givenPubSub();
    const pubsub1 = givenPubSub();
    const pubsub2 = givenPubSub();

    await pubsub1.subscribe('foo', () => {
      d.reject('should not run here');
    });
    await pubsub2.subscribe('foo.reply', () => {
      d.resolve();
    });
    await pubsub.publish('foo.reply', Buffer.from('hello'));
    await d;

    await pubsub.end();
    await pubsub1.end();
    await pubsub2.end();
  });
});
