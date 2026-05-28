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

  it('transitions to happy on notification', () => {
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
  });

  it('transitions happy → talking on happyComplete', () => {
    sm.notificationArrived();
    sm.happyComplete();
    expect(sm.state).toBe('talking');
  });

  it('transitions talking → idle when toast finished with no more queued', () => {
    sm.notificationArrived();
    sm.happyComplete();
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
  });

  it('stays talking when toast finished but more are queued', () => {
    sm.notificationArrived();
    sm.happyComplete();
    sm.toastFinished(true);
    expect(sm.state).toBe('talking');
  });

  it('transitions idle → sleeping on idle timeout', () => {
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
  });

  it('does not sleep if not idle', () => {
    sm.notificationArrived();
    sm.idleTimeout();
    expect(sm.state).toBe('happy');
  });

  it('wakes from sleeping on notification', () => {
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
  });

  it('stays talking if notification arrives while talking', () => {
    sm.notificationArrived();
    sm.happyComplete();
    expect(sm.state).toBe('talking');
    sm.notificationArrived();
    expect(sm.state).toBe('talking');
  });

  it('full cycle: idle → happy → talking → idle → sleeping → happy → talking → idle', () => {
    expect(sm.state).toBe('idle');
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
    sm.happyComplete();
    expect(sm.state).toBe('talking');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
    sm.happyComplete();
    expect(sm.state).toBe('talking');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
  });
});
