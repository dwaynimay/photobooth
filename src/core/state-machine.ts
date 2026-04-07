export type State = 'IDLE' | 'COUNTDOWN' | 'CAPTURE' | 'PREVIEW' | 'RESET';

export const State = {
  IDLE: 'IDLE',
  COUNTDOWN: 'COUNTDOWN',
  CAPTURE: 'CAPTURE',
  PREVIEW: 'PREVIEW',
  RESET: 'RESET',
} as const;

export type StateChangeCallback = (state: State) => void;

export class StateMachine {
  private currentState: State = State.IDLE;
  private listeners: StateChangeCallback[] = [];

  public getState(): State {
    return this.currentState;
  }

  public transition(newState: State): void {
    console.log(`[StateMachine] Transition: ${this.currentState} -> ${newState}`);
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
