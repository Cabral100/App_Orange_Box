"""Baixa o dataset Roboflow sem armazenar credenciais no projeto."""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", default="robofei-gf69f")
    parser.add_argument("--project", default="tcc-datasetreal")
    parser.add_argument("--version", type=int, default=9)
    parser.add_argument("--format", default="yolo26")
    parser.add_argument("--output", type=Path, default=Path("datasets/tcc-datasetreal-9"))
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        raise SystemExit(
            "Defina ROBOFLOW_API_KEY no ambiente. Nunca coloque a chave no código."
        )

    try:
        from roboflow import Roboflow
    except ImportError as exc:
        raise SystemExit(
            "Instale scripts/requirements-training.txt antes de baixar o dataset."
        ) from exc

    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and any(output.iterdir()) and not args.overwrite:
        raise SystemExit(
            f"O destino {output} já contém arquivos. Use --overwrite conscientemente."
        )

    client = Roboflow(api_key=api_key)
    version = client.workspace(args.workspace).project(args.project).version(args.version)
    dataset = version.download(
        args.format,
        location=str(output),
        overwrite=args.overwrite,
    )
    print(f"Dataset disponível em: {Path(dataset.location).resolve()}")
    print("Próximo passo: execute scripts/prepare_dataset.py em modo de leitura.")


if __name__ == "__main__":
    main()
