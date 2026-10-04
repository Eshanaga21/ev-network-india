import sys
from pathlib import Path

# Keep tests runnable directly from the repository without packaging it first.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
