import {defer} from '@jil/common/async/defer';
import {timeout} from '@jil/common/async/timeout';
import {givenBus, rabbit} from './support';

describe('Bus', () => {
  beforeAll(async () => {
    await rabbit.run();
  });

  it('should subscribe and publish', async () => {
    const sample = Buffer.from('Hello World!');
    const d = defer();
    const bus = givenBus();
    const queue = await bus.subscribe('$foo.:id', (params, message) => {
      expect(params).toEqual({id: 'bar'});
      expect(message.content).toEqual(sample);
      d.resolve();
    });
    expect(queue).toBeTruthy();
    await bus.publish('$foo.bar', sample);
    await timeout(500);
    await bus.end();
    await d;
  });
});
