python - <<'PY'
import json

with open("data/allowed_v2.json") as f:
    allowed = set(json.load(f))

with open("data/solutions_v2.json") as f:
    solutions = set(json.load(f))

missing = solutions - allowed

print(f"Palabras permitidas: {len(allowed)}")
print(f"Posibles soluciones: {len(solutions)}")
print(f"Soluciones no permitidas: {len(missing)}")

if missing:
    print("ERROR:", missing)
else:
    print("OK: Diccionarios consistentes")
PY