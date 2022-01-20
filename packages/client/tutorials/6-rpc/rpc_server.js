//const amqp = require('@amqc/client'); // normal use
const amqp = require('../..'); // for use inside this package

async function main() {
  // create a new connection (async)
  const connection = new amqp.Connection();

  // declare a rpc queue, it will be created if it does not already exist (async)
  const queue = connection.declareQueue('rpc_queue', {durable: false});

  // create a rpc consumer function for the queue, automatically returns the return value of the
  // consumer function to the replyTo queue, if it exists
  // this will keep running until the program is halted or is stopped with queue.cancel()
  await queue.consume(
    function (message) {
      const n = parseInt(message.getContent());
      console.log(' [.] fib(' + n + ')');

      // return fibonacci number
      const result = fibonacci(n);
      console.log(' [.] => result', result);
      return result;
    },
    {noAck: true},
  );

  console.log('started');
}

// compute the fibonacci number with iterative algorithm
// See: https://betterprogramming.pub/fibonacci-algorithm-in-javascript-45743f3a0ff6
// See: https://jsben.ch/Coore
function fibonacci(n) {
  const sequence = [0, 1];
  for (let i = 2; i <= n; i++) {
    sequence[i] = sequence[i - 2] + sequence[i - 1];
  }
  return sequence[n];
}

main().catch(console.error);
