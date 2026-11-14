#!/usr/bin/env python3

import json
import re
import unicodedata
from pathlib import Path

from wordfreq import top_n_list


# ==========================================
# CONFIGURACIÓN
# ==========================================

WORD_LENGTH = 5

# Número de términos de frecuencia que examinaremos
MAX_WORDS = 200000

# Número máximo de soluciones
MAX_SOLUTIONS = 3000

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(exist_ok=True)


# ==========================================
# NORMALIZACIÓN
# ==========================================

def normalize_word(word):

    word = word.strip().upper()

    # Proteger la Ñ
    word = word.replace("Ñ", "\uE000")

    # Eliminar tildes
    word = unicodedata.normalize("NFD", word)

    word = "".join(
        char
        for char in word
        if unicodedata.category(char) != "Mn"
    )

    # Recuperar la Ñ
    word = word.replace("\uE000", "Ñ")

    return word


# ==========================================
# VALIDACIÓN
# ==========================================

def valid_word(word):

    return (
        len(word) == WORD_LENGTH
        and re.fullmatch(r"[A-ZÑ]{5}", word) is not None
    )


# ==========================================
# GENERACIÓN
# ==========================================

print("Descargando/cargando vocabulario español...")

words = top_n_list("es", MAX_WORDS)

allowed = []
solutions = []

seen = set()

for original_word in words:

    word = normalize_word(original_word)

    if not valid_word(word):
        continue

    if word in seen:
        continue

    seen.add(word)

    allowed.append(word)

    # Las primeras palabras válidas son las más frecuentes
    if len(solutions) < MAX_SOLUTIONS:
        solutions.append(word)


# ==========================================
# GUARDAR RESULTADOS
# ==========================================

allowed.sort()
solutions.sort()

with open(
    DATA_DIR / "allowed.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        allowed,
        file,
        ensure_ascii=False,
        indent=2
    )


with open(
    DATA_DIR / "solutions.json",
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
# ESTADÍSTICAS
# ==========================================

print()
print("Diccionario generado correctamente")
print("----------------------------------")
print(f"Palabras permitidas: {len(allowed)}")
print(f"Posibles soluciones: {len(solutions)}")
print()

print("Ejemplos de palabras permitidas:")
print(", ".join(allowed[:20]))

print()
print("Archivos generados:")
print(DATA_DIR / "allowed.json")
print(DATA_DIR / "solutions.json")