import type { AppStep } from '../types';

export type StateChangeCallback = (state: AppStep) => void;

export class StateMachine {
  private currentState: AppStep = 'HOME';
  private listeners: StateChangeCallback[] = [];

  public getState(): AppStep {
    return this.currentState;
  }

  public transition(newState: AppStep): void {
    if (import.meta.env.DEV) {
      console.log(`[StateMachine] Transition: ${this.currentState} -> ${newState}`);
    }
    this.currentState = newState;
    this.notifyListeners();
  }

  public onStateChange(callback: StateChangeCallback): void {
    this.listeners.push(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback(this.currentState));
  }
}
