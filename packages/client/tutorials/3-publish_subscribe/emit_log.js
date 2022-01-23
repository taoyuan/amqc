//const amqp = require('@hamq/client'); // normal use
const amqp = require('../..'); // for use inside this package

async function main() {
  // create a new connection (async)
  const connection = new amqp.Connection();

  // declare a new exchange, it will be created if it does not already exist (async)
  const exchange = connection.declareExchange('logs', 'fanout', {durable: false});

  // get the message from the command line
  const message = new amqp.Message(process.argv.slice(2).join(' ') || 'Hello World!');

  // send a message, it will automatically be sent after the connection and the queue declaration
  // have finished successfully
  exchange.send(message);

  // not exactly true, but the message will be sent shortly
  console.log(" [x] Sent '" + message.getContent() + "'");

  // after half a second close the connection
  setTimeout(function () {
    connection.end();
  }, 500);
}

main().catch(console.error);
