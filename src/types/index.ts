export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Template {
  id: string;
  name: string;
  image: string;
  width: number;
  height: number;
  slots: Slot[];
  url?: string;
}

export type AppStep =
  | 'HOME'
  | 'LAYOUT'
  | 'PAYMENT'
  | 'CAPTURE'
  | 'CAPTURE_RETAKE'
  | 'APPLY_FRAME'
  | 'REVIEW'
  | 'PRINT';

export interface SessionState {
  images: string[];
  videos: Blob[];
  fullVideo: Blob | null;
}
