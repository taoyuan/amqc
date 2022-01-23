# @hamq/client

> A simple and elegant AMQP client written by TypeScript
>
> Inspired by [amqp-ts](https://www.npmjs.com/package/amqp-ts)

## Usage

### An example

```ts
import * as amqp from '@hamq/client';
// const amqp = require("@hamq/client"); // js require

async function run() {
  const connection = new amqp.Connection('amqp://localhost');
  const exchange = connection.declareExchange('ExchangeName');
  const queue = connection.declareQueue('QueueName');
  await queue.bind(exchange);
  await queue.consume(message => {
    console.log('Message received: ' + message.getContent());
  });

  // it is possible that the following message is not received because
  // it can be sent before the queue, binding or consumer exist
  const msg = new amqp.Message('Test');
  exchange.send(msg);

  await connection.ready();

  // the following message will be received because
  // everything you defined earlier for this connection now exists
  const msg2 = new amqp.Message('Test2');
  exchange.send(msg2);
}

run().catch(console.error);
```

More examples can be found in the
[tutorials directory](https://github.com/taoyuan/hamq/tree/master/packages/client/tutorials).

### Connection Status

- `connection.connected`: Returns true if the connection exists and false, otherwise.
- `connection.online()`: Resolved when connected.
- `connection.ready()`: Resolved when connected and all resources(actors) has been ready.

### Events

All
[events from connback](https://github.com/taoyuan/connback/tree/master/packages/core#connbacktconstructorconnector-connectort-options-connbackoptions)

### Automatic Reconnection

When the library detects that the connection with the AMQP server is lost, it tries to automatically reconnect to the
server.

It is powered by [connback](https://github.com/taoyuan/connback).

## Roadmap

- Better documentation
