# A Better TeslaMate Frontend

Tesla-inspired companion dashboard for [TeslaMate](https://github.com/teslamate-org/teslamate):
live car status over MQTT (including navigation, scheduled charge, TPMS, per-door
flags), drive and charge history with richer detail, stats (multi-car, charge spend),
timeline, places, and software updates — read-only against TeslaMate's Postgres.
TeslaMate itself is untouched.

**No auth built in.** Run behind your own reverse proxy / ingress on a trusted network.

## Quick start (Docker)

Prefer a **release tag** (semver). Every main build also gets an immutable `sha-<short>` tag. No floating `latest`.

```bash
IMG=ghcr.io/jmcglock/a-better-teslamate-frontend:1.1.3
# or pin a build: ...:sha-<short> from Packages / Actions

docker pull "$IMG"
docker run --rm -p 3000:3000 \
  -e DATABASE_URL='postgres://teslamate_ro:PASSWORD@db-host:5432/teslamate' \
  -e MQTT_URL='mqtt://mosquitto:1883' \
  "$IMG"
```

Or with Compose (set vars in a local `.env`, never commit it):

```bash
cp .env.example .env   # edit URLs / passwords + IMAGE_TAG
docker compose up -d
```

Image: `ghcr.io/jmcglock/a-better-teslamate-frontend`  
Tags: `1.1.3` / `v1.1.3` on releases; `sha-<short>` on every main build.

## What's in 1.1.3

- Security: bump transitive `nanoid` 3.3.16 → 3.3.18 (GHSA-2v37-7h3g-55p8 / CVE-2026-67213)

## What's in 1.1.2

- Fix Docker/CD TypeScript error: `viewTransition` experiment typed via cast

## What's in 1.1.1

- Quiet Tesla polish: page enter, view transitions, list/nav press, sticky nav shadow
- Live: status-dot pulse, map ring, SoC/speed crossfade, flag enter, reconnect toast
- Shared MQTT/SSE provider (one stream for all cars)
- Empty states and softer panel/charging cues (`prefers-reduced-motion` respected)

## What's in 1.1

- **Faster first load**: warm Postgres pool, settings + stats TTL cache, lazy MapLibre, route loading skeletons, `/api/health` for probes
- **Live vehicle**: active navigation, scheduled charge, update download/install progress, per-door/window, sunroof, TPMS soft warnings, service mode, parked duration
- **Home activity**: today / this week totals, last drive + last charge
- **Drive detail**: peak power / regen, ascent & descent, cabin temp, rated range, power + elevation charts
- **Charge detail**: wall energy & session efficiency, $/kWh, AC/DC, range gained, outside temp, location map
- **New pages**: Timeline (states), Places (charge/drive locations + geofences), Updates (software history)
- **Stats**: multi-car selector, monthly charge cost / energy

## Configuration

| Env var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (read-only user recommended) |
| `MQTT_URL` | mosquitto URL, e.g. `mqtt://mosquitto:1883` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | optional broker credentials |
| `CURRENCY` | currency symbol for charge costs (default `$`) |

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
cp .env.example .env.local   # fill in URLs — file is gitignored
npm install
npm run dev                  # http://localhost:3000
npm test
```

## Build your own image

```bash
docker build -t teslamate-frontend .
# listens on 3000
```

## Kubernetes

Example manifests (placeholder secret only): [`deploy/kubernetes.yaml`](deploy/kubernetes.yaml).

```bash
# edit DATABASE_URL in the Secret, then:
kubectl apply -f deploy/kubernetes.yaml
```

Public GHCR images need **no** `imagePullSecrets`. Keep real DB/MQTT credentials in
cluster secrets or an external secret store — never in git.

## CI / CD

| Workflow | Trigger | What it does |
|---|---|---|
| CI | PR + push to `main` | `npm test` + `npm run build` |
| CD | push to `main` (app paths), release, or manual | build/push `sha-<short>` image to GHCR |

CD authenticates with the job’s `GITHUB_TOKEN` only (`packages: write`). No long-lived
registry passwords are stored in the repo.

After the first successful CD run, if anonymous `docker pull` fails, set the package
public once:

**GitHub → profile → Packages → `a-better-teslamate-frontend` → Package settings → Change visibility → Public**

## Security notes

- This app is a **read-only UI** over your TeslaMate data. Treat it like Grafana: private network or SSO at the edge.
- `.env` / `.env.local` are gitignored. Only `.env.example` (placeholders) is tracked.
- Do not put production `DATABASE_URL`, MQTT passwords, or kube secrets in this repository.

## License

MIT — see [LICENSE](LICENSE).
