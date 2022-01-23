import {IncomingMessage} from '@hamq/client';
import {AmqpTopic, Router} from 'routery';

export class AmqpRouter extends Router<IncomingMessage> {
  constructor() {
    super({...AmqpTopic});
  }
}
