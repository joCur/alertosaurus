export type PetState = 'idle' | 'going-to-sleep' | 'sleeping' | 'waking' | 'roaring';

export class PetStateMachine {
  private _state: PetState = 'idle';

  get state(): PetState {
    return this._state;
  }

  notificationArrived(): PetState {
    if (this._state === 'roaring') {
      return this._state;
    }
    if (this._state === 'sleeping' || this._state === 'going-to-sleep') {
      this._state = 'waking';
    } else if (this._state === 'waking') {
      return this._state;
    } else {
      this._state = 'roaring';
    }
    return this._state;
  }

  transitionComplete(): PetState {
    if (this._state === 'going-to-sleep') {
      this._state = 'sleeping';
    } else if (this._state === 'waking') {
      this._state = 'roaring';
    }
    return this._state;
  }

  toastFinished(moreQueued: boolean): PetState {
    this._state = moreQueued ? 'roaring' : 'idle';
    return this._state;
  }

  idleTimeout(): PetState {
    if (this._state === 'idle') {
      this._state = 'going-to-sleep';
    }
    return this._state;
  }
}
