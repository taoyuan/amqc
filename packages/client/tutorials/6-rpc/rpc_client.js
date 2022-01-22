//const amqp = require('@hamqp/client'); // normal use
const amqp = require('../..'); // for use inside this package

async function main() {
  // create a new connection (async)
  const connection = new amqp.Connection();

  // declare the rpc_queue queue, it will be created if it does not already exist (async)
  const queue = connection.declareQueue('rpc_queue', {durable: false});

  // get the number for fibonacci from the command line
  const args = process.argv.slice(2);
  const num = parseInt(args[0] ?? 30);

  console.log(' [x] Requesting fib(%d)', num);

  // easy optimized rpc for RabbitMQ
  // send a rpc request, it will automatically be sent after the queue declaration
  // has finished successfully
  const result = await queue.rpc(num);
  console.log(' [.] Got ', result.getContent());

  // or use the method explained in the tutorial
  // todo: write the code!

  // after half a second close the connection
  setTimeout(function () {
    connection.end();
  }, 500);
}

main().catch(console.error);
