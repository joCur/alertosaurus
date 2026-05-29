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

  it('transitions idle → going-to-sleep on idle timeout', () => {
    sm.idleTimeout();
    expect(sm.state).toBe('going-to-sleep');
  });

  it('transitions going-to-sleep → sleeping on transitionComplete', () => {
    sm.idleTimeout();
    sm.transitionComplete();
    expect(sm.state).toBe('sleeping');
  });

  it('does not sleep if not idle', () => {
    sm.notificationArrived();
    sm.idleTimeout();
    expect(sm.state).toBe('roaring');
  });

  it('wakes from sleeping on notification', () => {
    sm.idleTimeout();
    sm.transitionComplete();
    expect(sm.state).toBe('sleeping');
    sm.notificationArrived();
    expect(sm.state).toBe('waking');
  });

  it('transitions waking → roaring on transitionComplete', () => {
    sm.idleTimeout();
    sm.transitionComplete();
    sm.notificationArrived();
    expect(sm.state).toBe('waking');
    sm.transitionComplete();
    expect(sm.state).toBe('roaring');
  });

  it('interrupts going-to-sleep with waking on notification', () => {
    sm.idleTimeout();
    expect(sm.state).toBe('going-to-sleep');
    sm.notificationArrived();
    expect(sm.state).toBe('waking');
    sm.transitionComplete();
    expect(sm.state).toBe('roaring');
  });

  it('stays roaring if notification arrives while roaring', () => {
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
  });

  it('stays waking if notification arrives while waking', () => {
    sm.idleTimeout();
    sm.transitionComplete();
    sm.notificationArrived();
    expect(sm.state).toBe('waking');
    sm.notificationArrived();
    expect(sm.state).toBe('waking');
  });

  it('full cycle: idle → roaring → idle → going-to-sleep → sleeping → waking → roaring → idle', () => {
    expect(sm.state).toBe('idle');
    sm.notificationArrived();
    expect(sm.state).toBe('roaring');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
    sm.idleTimeout();
    expect(sm.state).toBe('going-to-sleep');
    sm.transitionComplete();
    expect(sm.state).toBe('sleeping');
    sm.notificationArrived();
    expect(sm.state).toBe('waking');
    sm.transitionComplete();
    expect(sm.state).toBe('roaring');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
  });
});
