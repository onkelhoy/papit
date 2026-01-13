import { WebSocket } from 'ws';

export interface Socket extends WebSocket {
  id: string;
  is_alive: boolean;
  strike: number;
  lastmessage?: number;
}

export interface NetworkInfo extends Record<string, any> {
  id: string;
  host: string;
}