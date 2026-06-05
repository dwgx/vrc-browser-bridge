import WebSocket from "ws";
import type { BridgeEvent } from "@vrcbb/protocol";

export interface ControlClientOptions {
  url: string;
  onStatus: (message: string) => void;
}

export class ControlClient {
  private socket: WebSocket | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private queue: BridgeEvent[] = [];
  private closed = false;

  constructor(private readonly options: ControlClientOptions) {}

  start(): void {
    this.connect();
  }

  stop(): void {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  send(event: BridgeEvent): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
      return;
    }

    this.queue.push(event);
    this.options.onStatus(`queued event ${event.type} #${event.seq}; control server is not connected`);
  }

  private connect(): void {
    if (this.closed) {
      return;
    }

    this.options.onStatus(`connecting ${this.options.url}`);
    this.socket = new WebSocket(this.options.url);

    this.socket.on("open", () => {
      this.options.onStatus("control server connected");
      this.flush();
    });

    this.socket.on("message", (message) => {
      this.options.onStatus(`server ${message.toString()}`);
    });

    this.socket.on("close", () => {
      this.options.onStatus("control server disconnected; reconnecting");
      this.scheduleReconnect();
    });

    this.socket.on("error", (error) => {
      this.options.onStatus(`control server error: ${error.message}`);
    });
  }

  private flush(): void {
    while (this.queue.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      const event = this.queue.shift();
      if (event) {
        this.socket.send(JSON.stringify(event));
      }
    }
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 1000);
  }
}
