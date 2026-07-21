# A Better TeslaMate Frontend

Tesla-inspired companion dashboard for [TeslaMate](https://github.com/teslamate-org/teslamate):
live car status over MQTT, drive and charge history, and stats — read-only against
TeslaMate's Postgres. TeslaMate itself is untouched.

**No auth built in.** Run behind your own reverse proxy / ingress on a trusted network.

## Quick start (Docker)

Images are tagged by **git SHA** (immutable). No floating `latest`.

```bash
# pick a SHA tag from Packages / Actions, e.g. sha-358ea47
IMG=ghcr.io/jmcglock/a-better-teslamate-frontend:sha-358ea47

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
Tags: `sha-<short>` on every main build; optional manual tag; semver on GitHub Releases.

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
