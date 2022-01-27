import {Rabbit} from '@hamq/testlab';
import {PubSub} from '../pubsub';

export const rabbit = new Rabbit();

export function givenPubSub() {
  return new PubSub(rabbit.url, {
    jitter: 'none',
    delayFirstAttempt: true,
  });
}
