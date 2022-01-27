import {defer} from '@jil/common/async/defer';
import {timeout} from '@jil/common/async/timeout';
import {Rabbit} from "@hamq/testlab";
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
});
