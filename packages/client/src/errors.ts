import {Error, Error as ChainableError} from 'chainable-error';

export class DeclareError extends ChainableError {
  constructor(msg: string, cause: Error) {
    super(msg, cause);
  }
}
