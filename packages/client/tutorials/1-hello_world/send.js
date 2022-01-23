// import * as amqp from '@hamq/client'; // normal ts use
// const amqp = require('@hamq/client'); // normal js use
const amqp = require('../..');

async function main() {
  // create a new connection (async)
  const connection = new amqp.Connection();

  // declare a new queue, it will be created if it does not already exist (async)
  const queue = connection.declareQueue('hello', {durable: false});

  // send a message, it will automatically be sent after the connection and the queue declaration
  // have finished successfully
  const message = new amqp.Message('Hello World!');
  queue.send(message);

  // not exactly true, but the message will be sent shortly
  console.log(" [x] Sent 'Hello World!'");

  // after half a second close the connection
  setTimeout(function () {
    connection.end();
  }, 500);
}

main().catch(console.error);
