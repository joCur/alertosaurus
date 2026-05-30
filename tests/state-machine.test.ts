import { describe, it, expect, beforeEach } from 'vitest';
import { PetStateMachine } from '../src/main/state-machine';

describe('PetStateMachine', () => {
  let sm: PetStateMachine;

  beforeEach(() => {
    sm = new PetStateMachine();
  });

  it('starts in idle state', () => {
    expect(sm.state).toBe('idle');
  });

  it('transitions to roaring on notification from idle', () => {
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
  });

  it('transitions to roaring on notification from sleeping', () => {
    sm.idleTimeout();
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
  });

  it('stays roaring if notification arrives while roaring', () => {
    sm.notificationArrived();
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
  });

  it('transitions roaring → idle when toast finished with no more queued', () => {
    sm.notificationArrived();
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
  });

  it('stays roaring when toast finished but more are queued', () => {
    sm.notificationArrived();
    sm.toastFinished(true);
    expect(sm.state).toBe('roaring');
  });

  it('transitions idle → sleeping on idle timeout', () => {
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
  });

  it('does not sleep if not idle', () => {
    sm.notificationArrived();
    sm.idleTimeout();
    expect(sm.state).toBe('roaring');
  });

  it('full cycle: idle → roaring → idle → sleeping → roaring → idle', () => {
    expect(sm.state).toBe('idle');
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
  });
});
