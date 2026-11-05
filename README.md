# Cyclowareness-Mark3

Cyclowareness is a security-awareness platform: lessons with the AI Sel mascot in ten languages, phishing simulations, human-risk scoring and security operations. The app is in [`portal/`](portal/README.md).

## Three-minute demo

```bash
npm --prefix portal run demo
```

Then open http://localhost:3000/sign-in?next=/admin/drill and follow [docs/DEMO.md](docs/DEMO.md). Requirements: Node.js 22 or newer. With Docker instead: `docker compose -f portal/docker-compose.demo.yml up --build`.
