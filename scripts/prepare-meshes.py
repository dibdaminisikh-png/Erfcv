"""Convert a binary STL to anonymous, welded EMC1 geometry. Requires NumPy."""
import argparse
import pathlib
import struct
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=pathlib.Path)
parser.add_argument("destination", type=pathlib.Path)
args = parser.parse_args()
raw = args.source.read_bytes()
if len(raw) < 84:
    raise ValueError("The source must be a binary STL")
count = struct.unpack_from("<I", raw, 80)[0]
if len(raw) != 84 + 50 * count or count == 0:
    raise ValueError("Invalid or empty binary STL")
layout = np.dtype([("normal", "<f4", (3,)), ("vertices", "<f4", (3, 3)), ("attribute", "<u2")])
points = np.frombuffer(raw, dtype=layout, offset=84, count=count)["vertices"].copy().reshape(-1, 3)
if not np.isfinite(points).all():
    raise ValueError("The source contains non-finite coordinates")
vertices, inverse = np.unique(points, axis=0, return_inverse=True)
minimum, maximum = vertices.min(0), vertices.max(0)
span = np.maximum(maximum - minimum, 1e-9)
quantized = np.rint((vertices - minimum) / span * 65535).astype("<u2")
wide = len(vertices) > 65535
indices = inverse.reshape(-1, 3).astype("<u4" if wide else "<u2")
header = b"EMC1" + struct.pack("<III", len(vertices), len(indices) * 3, 4 if wide else 2)
header += minimum.astype("<f4").tobytes() + maximum.astype("<f4").tobytes()
args.destination.write_bytes(header + quantized.tobytes() + indices.tobytes())
print(f"Wrote {len(indices):,} faces to {args.destination.name}")
