const {Docker} = require('docker-cli-js');

const docker = new Docker();

export class Rabbit {
  readonly url: string;

  protected docker = new Docker();

  constructor(readonly name: string, readonly port = 5673, readonly managePort = 15673) {
    this.url = `amqp://localhost:${port}`;
  }

  async check() {
    const result = await docker.command(`ps --filter "name=${this.name}"`);
    return result.containerList.length > 0;
  }

  async run() {
    if (!(await this.check())) {
      await docker.command(
        `run -d --name ${this.name} -p ${this.port}:5672 -p ${this.managePort}:15672 rabbitmq:management`,
      );
    }
  }

  async rm() {
    await docker.command(`rm -f ${this.name}`);
  }

  async stopApp() {
    await docker.command(`exec ${this.name} rabbitmqctl stop_app`);
  }

  async startApp() {
    await docker.command(`exec ${this.name} rabbitmqctl start_app`);
  }

  async restartApp() {
    await this.stopApp();
    await this.startApp();
  }
}
