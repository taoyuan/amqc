import path from 'path';

export const APP_NAME =
  process.env.AMQP_APPLICATIONNAME || (path.parse ? path.parse(process.argv[1]).name : path.basename(process.argv[1]));

// name for the RabbitMQ direct reply-to queue
export const DIRECT_REPLY_TO_QUEUE = 'amq.rabbitmq.reply-to';
