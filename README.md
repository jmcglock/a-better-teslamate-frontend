# A Better TeslaMate Dashboard

Tesla-inspired companion dashboard for [TeslaMate](https://github.com/teslamate-org/teslamate):
live car status over MQTT, drive and charge history, and stats — read-only against
TeslaMate's Postgres. TeslaMate itself is untouched.

## Configuration

| Env var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (read-only user recommended) |
| `MQTT_URL` | mosquitto URL, e.g. `mqtt://mosquitto:1883` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | optional broker credentials |

Create a read-only DB user:

```sql
CREATE USER teslamate_ro WITH PASSWORD '...';
GRANT CONNECT ON DATABASE teslamate TO teslamate_ro;
GRANT USAGE ON SCHEMA public TO teslamate_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO teslamate_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO teslamate_ro;
```

## Development

```bash
cp .env.example .env.local   # fill in URLs
npm install
npm run dev                  # http://localhost:3000
npm test
```

## Deployment

`docker build -t teslamate-frontend .` — listens on 3000. No auth built in;
run it behind your ingress on a trusted network.
