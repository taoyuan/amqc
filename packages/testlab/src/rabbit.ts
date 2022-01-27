const {Docker} = require('docker-cli-js');

export class Rabbit {
  readonly url: string;

  protected docker = new Docker();

  static Timeout = 30000;

  constructor(readonly name: string = 'hamq.test', readonly port = 5673, readonly managePort = 15673) {
    this.url = `amqp://localhost:${port}`;
  }

  async check() {
    const result = await this.docker.command(`ps --filter "name=${this.name}"`);
    return result.containerList.length > 0;
  }

  async run() {
    if (!(await this.check())) {
      await this.docker.command(
        `run -d --name ${this.name} -p ${this.port}:5672 -p ${this.managePort}:15672 rabbitmq:management`,
      );
      await new Promise(resolve => setTimeout(() => resolve(undefined), 10000));
    }
  }

  async rm() {
    await this.docker.command(`rm -f ${this.name}`);
  }

  async stopApp() {
    await this.docker.command(`exec ${this.name} rabbitmqctl stop_app`);
  }

  async startApp() {
    await this.docker.command(`exec ${this.name} rabbitmqctl start_app`);
  }

  async restartApp() {
    await this.stopApp();
    await this.startApp();
  }
}
