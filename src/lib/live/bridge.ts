import { EventEmitter } from "node:events";
import mqtt, { type MqttClient } from "mqtt";
import { applyMessage, parseTopic, type CarSnapshot } from "./snapshot";

export class MqttBridge extends EventEmitter {
  private snapshots = new Map<number, CarSnapshot>();
  private client: MqttClient;
  connected = false;

  constructor(url: string) {
    super();
    this.setMaxListeners(50);
    this.client = mqtt.connect(url, {
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      reconnectPeriod: 5000,
    });
    this.client.on("connect", () => {
      this.connected = true;
      this.client.subscribe("teslamate/cars/+/+");
    });
    this.client.on("close", () => { this.connected = false; });
    this.client.on("message", (topic, payload) => {
      const parsed = parseTopic(topic);
      if (!parsed) return;
      const prev = this.snapshots.get(parsed.carId) ?? {};
      const next = applyMessage(prev, parsed.field, payload.toString());
      this.snapshots.set(parsed.carId, next);
      this.emit("update", parsed.carId, next);
    });
  }

  getSnapshots(): Array<[number, CarSnapshot]> {
    return [...this.snapshots.entries()];
  }
}

const g = globalThis as unknown as { mqttBridge?: MqttBridge };

export function getBridge(): MqttBridge {
  if (!g.mqttBridge) g.mqttBridge = new MqttBridge(process.env.MQTT_URL ?? "mqtt://localhost:1883");
  return g.mqttBridge;
}
