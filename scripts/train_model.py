"""Treina/valida o detector YOLO do projeto com configuração reproduzível."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="Caminho de data.yaml.")
    parser.add_argument("--base", default="yolo26n.pt", help="Peso/modelo inicial.")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--project", default="runs/cyf")
    parser.add_argument("--name", default="yolo26n-detect")
    parser.add_argument("--test-split", default="test")
    parser.add_argument("--conf", type=float, default=0.5)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def mean_latency_ms(model, image_paths: list[Path], conf: float, device: str) -> float | None:
    if not image_paths:
        return None
    # Aquecimento separado para não contaminar a média.
    model.predict(source=str(image_paths[0]), conf=conf, device=device, verbose=False)
    samples: list[float] = []
    for path in image_paths:
        started = time.perf_counter()
        model.predict(source=str(path), conf=conf, device=device, verbose=False)
        samples.append((time.perf_counter() - started) * 1000)
    return sum(samples) / len(samples)


def main() -> None:
    args = parse_args()
    data_yaml = args.data.resolve()
    if not data_yaml.is_file():
        raise SystemExit(f"data.yaml não encontrado: {data_yaml}")

    from ultralytics import YOLO

    model = YOLO(args.base, task="detect")
    train_result = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        project=args.project,
        name=args.name,
        seed=args.seed,
        deterministic=True,
        plots=True,
    )

    best_path = Path(train_result.save_dir) / "weights" / "best.pt"
    best_model = YOLO(str(best_path), task="detect")
    metrics = best_model.val(data=str(data_yaml), split=args.test_split, device=args.device)
    precision = float(metrics.box.p.mean())
    recall = float(metrics.box.r.mean())
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    test_images = []
    test_root = data_yaml.parent / args.test_split / "images"
    for pattern in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
        test_images.extend(test_root.glob(pattern))
    latency = mean_latency_ms(best_model, sorted(test_images), args.conf, args.device)

    report = {
        "model": str(best_path.resolve()),
        "split": args.test_split,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "map50": float(metrics.box.map50),
        "map50_95": float(metrics.box.map),
        "latency_ms_per_image": latency,
        "fps": 1000 / latency if latency else None,
        "test_images": len(test_images),
    }
    report_path = Path(train_result.save_dir) / "test_metrics.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
