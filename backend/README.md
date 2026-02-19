# AI English Mentor Backend

## Quick start (native)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## GitHub Copilot auth (optional)

```bash
cd backend
python -m app.cli.copilot_auth login
python -m app.cli.copilot_auth status
python -m app.cli.copilot_auth logout
```

## Tests

```bash
cd backend
pytest -q
```
