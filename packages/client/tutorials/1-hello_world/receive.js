// import * as amqp from '@hamqp/client'; // normal ts use
// const amqp = require('@hamqp/client'); // normal js use
const amqp = require('../..');

async function main() {
  // create a new connection (async)
  const conn = new amqp.Connection();

  conn.onconnect(() => {
    console.log('connected');
  });

  conn.onclose(() => {
    console.log('disconnected');
  });

  conn.onoffline(() => {
    // from connected to disconnected
    console.log('offline');
  });

  // declare a new queue, it will be created if it does not already exist (async)
  const queue = conn.declareQueue('hello', {durable: false});

  // create a consumer function for the queue
  // this will keep running until the program is halted or is stopped with queue.cancel()
  await queue.consume(
    message => {
      console.log('received message: ' + message.getContent());
    },
    {noAck: true},
  );

  console.log('started');
}

main().catch(console.error);
