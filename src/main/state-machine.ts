export type PetState = 'idle' | 'sleeping' | 'roaring';

export class PetStateMachine {
  private _state: PetState = 'idle';

  get state(): PetState {
    return this._state;
  }

  notificationArrived(): PetState {
    if (this._state !== 'roaring') {
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
      this._state = 'sleeping';
    }
    return this._state;
  }
}
