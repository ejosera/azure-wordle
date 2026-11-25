import json
import re
import unicodedata
import subprocess
from pathlib import Path
from wordfreq import top_n_list

# ==========================================
# CONFIGURACION
# ==========================================

LANGUAGE = "es"
HUNSPELL_DICT = "es_ES"

MAX_WORDS = 200000
MAX_SOLUTIONS = 3000
WORD_LENGTH = 5

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(exist_ok=True)

# ==========================================
# NORMALIZACION
# ==========================================

def normalize_word(word):

    word = unicodedata.normalize("NFC", word)
    word = word.strip().upper()

    # Proteger la Ñ
    word = word.replace("Ñ", "\uE000")

    # Eliminar tildes
    word = unicodedata.normalize("NFD", word)

    word = "".join(
        char for char in word
        if unicodedata.category(char) != "Mn"
    )

    # Recuperar la Ñ
    word = word.replace("\uE000", "Ñ")

    return word


# ==========================================
# OBTENER PALABRAS DE WORDFREQ
# ==========================================

print("Obteniendo palabras de Wordfreq...")

words = top_n_list(LANGUAGE, MAX_WORDS)

print(f"Palabras originales: {len(words)}")

# ==========================================
# FILTRAR PALABRAS DE CINCO LETRAS
# ==========================================

candidates = []

for word in words:

    word = unicodedata.normalize("NFC", word)

    if len(word) != WORD_LENGTH:
        continue

    if not re.fullmatch(r"[a-záéíóúüñ]{5}", word):
        continue

    candidates.append(word)

print(f"Candidatas de cinco letras: {len(candidates)}")

# ==========================================
# VALIDAR CON HUNSPELL
# ==========================================

print("Validando palabras con Hunspell...")

result = subprocess.run(
    ["hunspell", "-d", HUNSPELL_DICT, "-i", "UTF-8", "-l"],
    input="\n".join(candidates) + "\n",
    capture_output=True,
    text=True,
    encoding="utf-8",
    check=True
)

rejected = set(result.stdout.splitlines())

# ==========================================
# GENERAR LISTA DE PALABRAS VALIDAS
# ==========================================

valid_words = []
seen = set()

for word in candidates:

    if word in rejected:
        continue

    normalized = normalize_word(word)

    if not re.fullmatch(r"[A-ZÑ]{5}", normalized):
        continue

    if normalized in seen:
        continue

    seen.add(normalized)
    valid_words.append(normalized)

# ==========================================
# CARGAR LISTAS DE EXCLUSION
# ==========================================

TOOLS_DIR = BASE_DIR / "tools"


def load_exclusions(filename):

    path = TOOLS_DIR / filename

    if not path.exists():
        return set()

    excluded = set()

    for line in path.read_text(encoding="utf-8").splitlines():

        line = line.strip()

        if not line or line.startswith("#"):
            continue

        excluded.add(normalize_word(line))

    return excluded


excluded_words = load_exclusions("excluded_words.txt")

excluded_solutions = load_exclusions("excluded_solutions.txt")

print(f"Exclusiones generales: {len(excluded_words)}")
print(f"Exclusiones de soluciones: {len(excluded_solutions)}")


# ==========================================
# GENERAR DICCIONARIOS
# ==========================================

allowed = sorted(
    word for word in valid_words
    if word not in excluded_words
)

solutions = [
    word for word in valid_words
    if word not in excluded_words
    and word not in excluded_solutions
][:MAX_SOLUTIONS]

# ==========================================
# GUARDAR ALLOWED
# ==========================================

with open(
    DATA_DIR / "allowed_v2.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        allowed,
        file,
        ensure_ascii=False,
        indent=2
    )

# ==========================================
# GUARDAR SOLUTIONS
# ==========================================

with open(
    DATA_DIR / "solutions_v2.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        solutions,
        file,
        ensure_ascii=False,
        indent=2
    )

# ==========================================
# GUARDAR PALABRAS RECHAZADAS
# ==========================================

with open(
    DATA_DIR / "rejected_v2.txt",
    "w",
    encoding="utf-8"
) as file:

    for word in sorted(rejected):
        file.write(word + "\n")

# ==========================================
# GENERAR INFORME
# ==========================================

report = f"""
==========================================
AZURE WORDLE - DICTIONARY REPORT V2
==========================================

Idioma:                 {LANGUAGE}
Diccionario Hunspell:   {HUNSPELL_DICT}

Palabras originales:    {len(words)}
Candidatas:             {len(candidates)}
Rechazadas:             {len(rejected)}

Palabras permitidas:     {len(allowed)}
Posibles soluciones:    {len(solutions)}

==========================================
"""

with open(
    DATA_DIR / "report_v2.txt",
    "w",
    encoding="utf-8"
) as file:

    file.write(report)

print(report)

print("Diccionarios generados correctamente.")