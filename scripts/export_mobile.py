"""Exporta o checkpoint para um formato móvel; a saída ainda exige validação no aparelho."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=Path("backend/models/best.pt"))
    parser.add_argument("--format", choices=("tflite", "onnx"), default="tflite")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--half", action="store_true")
    args = parser.parse_args()

    model_path = args.model.resolve()
    if not model_path.is_file():
        raise SystemExit(f"Checkpoint não encontrado: {model_path}")

    from ultralytics import YOLO

    model = YOLO(str(model_path), task="detect")
    exported = model.export(
        format=args.format,
        imgsz=args.imgsz,
        half=args.half,
    )
    print(f"Exportado para: {exported}")
    print("Valide caixas, confiança, latência e consumo no hardware-alvo antes de uso em campo.")


if __name__ == "__main__":
    main()
