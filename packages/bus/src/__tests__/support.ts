import {Rabbit} from '@hamq/testlab';
import {Bus} from '../bus';

export const rabbit = new Rabbit();

export function givenBus() {
  return new Bus(rabbit.url, {
    jitter: 'none',
    delayFirstAttempt: true,
  });
}
