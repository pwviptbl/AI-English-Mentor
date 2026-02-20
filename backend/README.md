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



## Tests

```bash
cd backend
pytest -q
```
