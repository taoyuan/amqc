/* eslint-disable @typescript-eslint/no-explicit-any */

import {BaseDisposable} from '@jil/common/lifecycle/disposable';
import {Connection} from './connection';
import {DeclareError} from './errors';
import {defer, DeferredPromise} from '@jil/common/async/defer';
import noop from 'tily/function/noop';

const debug = require('debug')('hamq:client:actor');

export abstract class Actor extends BaseDisposable {
  connection?: Connection;
  id: string;
  protected deferredDeclare = defer();
  protected deferredUndeclare?: DeferredPromise<any>;

  protected constructor(connection: Connection, id: string) {
    super();

    this.connection = connection;
    this.id = id;

    connection.onclose(
      () => {
        this.deactivate();
      },
      undefined,
      this._store,
    );

    connection.onconnect(
      () => {
        this.activate();
      },
      undefined,
      this._store,
    );

    if (connection.connected) {
      // declare after constructor completing
      process.nextTick(() => this.declare());
    }
  }

  private _declaring = false;

  get declaring(): boolean {
    return this._declaring;
  }

  get name() {
    return this.id;
  }

  get declared(): Promise<any> {
    return this.deferredDeclare.promise;
  }

  async ready() {
    debug('wait ready');
    await this.deferredDeclare;
  }

  delete() {
    return this.close(true);
  }

  /**
   *
   * @param del Whether to delete self from amqp server when close
   */
  close(del?: boolean): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!this.deferredUndeclare) {
      debug(`<%s> close - doClose`, this.id);
      this.deferredUndeclare = defer();
      this.deferredUndeclare.resolve(this.doClose(del));
    } else {
      debug(`<%s> close - waiting undeclaring`, this.id);
    }
    return this.deferredUndeclare.promise;
  }

  /**
   * deactivate and detach from connection
   */
  invalidate() {
    debug(`<%s> invalidate`, this.id);
    this.deactivate();
    this.detach();
  }

  /**
   * invalidate and dispose all resources
   */
  dispose() {
    debug(`<%s> dispose`, this.id);
    this.invalidate();
    super.dispose();
    this.connection = undefined;
  }

  protected resetDeferredDeclare() {
    debug(`<%s> resetDeferredDeclare`, this.id);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!this.deferredDeclare || this.deferredDeclare.isSettled) {
      this.deferredDeclare = defer();
    }
  }

  /**
   * activate actor to AMQP server
   *
   * @protected
   */
  protected activate() {
    this.declare();
  }

  /**
   * clear activated states
   *
   * @protected
   */
  protected deactivate() {
    // this.resetDeferredDeclare();
  }

  protected declare(): void {
    debug('<%s> declare', this.id);
    this._declaring = true;
    // TODO is it necessary ?
    this.resetDeferredDeclare();
    const d = this.deferredDeclare;
    this.doDeclare()
      .then(d.resolve)
      .catch(err => {
        // if (debug.enabled) {
        //   debug(err);
        // }
        if (!(err instanceof DeclareError)) {
          err = new DeclareError(`${this.constructor.name} declare failed`, err);
        }
        d.reject(err);
      });

    d.then(() => {
      debug(`<%s> declared`, this.id);
      // noop error handler to avoid promise unhandled error. we can handle the exception with await .declared or await .ready()
    }, noop).finally(() => (this._declaring = false));
  }

  /**
   * Attach to connection
   */
  protected attach() {
    debug(`<%s> attach`, this.id);
    this.connection?.forActors(this).add(this);
    this.connection?.resetReady();
  }

  /**
   * Detach from connection
   */
  protected detach() {
    debug(`<%s> detach`, this.id);
    this.connection?.forActors(this).remove(this);
    this.connection?.resetReady();
  }

  protected abstract doDeclare(): Promise<any>;

  protected abstract doClose(del?: boolean): Promise<any>;
}
