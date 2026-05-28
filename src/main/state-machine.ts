export type PetState = 'idle' | 'happy' | 'talking' | 'sleeping';

export class PetStateMachine {
  private _state: PetState = 'idle';

  get state(): PetState {
    return this._state;
  }

  notificationArrived(): PetState {
    if (this._state !== 'talking') {
      this._state = 'happy';
    }
    return this._state;
  }

  happyComplete(): PetState {
    if (this._state === 'happy') {
      this._state = 'talking';
    }
    return this._state;
  }

  toastFinished(moreQueued: boolean): PetState {
    this._state = moreQueued ? 'talking' : 'idle';
    return this._state;
  }

  idleTimeout(): PetState {
    if (this._state === 'idle') {
      this._state = 'sleeping';
    }
    return this._state;
  }
}
