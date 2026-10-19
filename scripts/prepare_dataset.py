"""Valida labels YOLO de detecção e converte polígonos para bounding boxes."""

from __future__ import annotations

import argparse
import shutil
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ParsedLine:
    value: str | None
    outcome: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True, help="Raiz do dataset.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Grava as correções. Sem esta opção, apenas relata o que faria.",
    )
    parser.add_argument(
        "--backup",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Cria .bak antes de alterar labels (padrão: ativo).",
    )
    return parser.parse_args()


def normalized(values: list[float]) -> bool:
    return all(0.0 <= value <= 1.0 for value in values)


def parse_label(line: str) -> ParsedLine:
    tokens = line.split()
    if not tokens:
        return ParsedLine(None, "blank")

    try:
        class_value = float(tokens[0])
        class_id = int(class_value)
        coordinates = [float(token) for token in tokens[1:]]
    except ValueError:
        return ParsedLine(None, "invalid")

    if class_value != class_id or class_id < 0:
        return ParsedLine(None, "invalid")

    if len(tokens) == 5:
        cx, cy, width, height = coordinates
        if not normalized(coordinates) or width <= 0 or height <= 0:
            return ParsedLine(None, "invalid")
        return ParsedLine(
            f"{class_id} {cx:.8g} {cy:.8g} {width:.8g} {height:.8g}",
            "box_valid",
        )

    # Uma segmentação YOLO tem classe + pelo menos 3 pares (x, y).
    if len(tokens) >= 7 and len(coordinates) % 2 == 0 and normalized(coordinates):
        xs = coordinates[0::2]
        ys = coordinates[1::2]
        x1, x2 = min(xs), max(xs)
        y1, y2 = min(ys), max(ys)
        width, height = x2 - x1, y2 - y1
        if width <= 0 or height <= 0:
            return ParsedLine(None, "invalid")
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        return ParsedLine(
            f"{class_id} {cx:.8g} {cy:.8g} {width:.8g} {height:.8g}",
            "polygon_to_box",
        )

    return ParsedLine(None, "invalid")


def find_label_files(dataset: Path) -> list[Path]:
    return sorted(
        path
        for path in dataset.rglob("*.txt")
        if path.parent.name.lower() == "labels" and path.name != "classes.txt"
    )


def main() -> None:
    args = parse_args()
    dataset = args.dataset.resolve()
    if not dataset.is_dir():
        raise SystemExit(f"Dataset não encontrado: {dataset}")

    files = find_label_files(dataset)
    if not files:
        raise SystemExit("Nenhum label .txt foi encontrado em diretórios labels/.")

    totals: Counter[str] = Counter()
    changed_files = 0
    for path in files:
        source = path.read_text(encoding="utf-8").splitlines()
        parsed = [parse_label(line) for line in source]
        totals.update(item.outcome for item in parsed)
        output = [item.value for item in parsed if item.value is not None]
        expected = "\n".join(output) + ("\n" if output else "")
        current = "\n".join(source) + ("\n" if source else "")
        if expected == current:
            continue
        changed_files += 1
        if args.apply:
            if args.backup:
                backup = path.with_suffix(path.suffix + ".bak")
                if not backup.exists():
                    shutil.copy2(path, backup)
            path.write_text(expected, encoding="utf-8", newline="\n")

    caches = list(dataset.rglob("*.cache"))
    if args.apply:
        for cache in caches:
            cache.unlink()

    mode = "APLICADO" if args.apply else "SOMENTE LEITURA"
    print(f"Modo: {mode}")
    print(f"Arquivos analisados: {len(files)}")
    print(f"Arquivos que mudariam: {changed_files}")
    print(f"Bounding boxes válidas: {totals['box_valid']}")
    print(f"Polígonos a converter para boxes: {totals['polygon_to_box']}")
    print(f"Linhas inválidas a remover: {totals['invalid']}")
    print(f"Caches a remover: {len(caches)}")
    if not args.apply:
        print("Revise os números e execute novamente com --apply para gravar.")


if __name__ == "__main__":
    main()
