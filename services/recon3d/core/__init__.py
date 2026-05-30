"""OpenEyes 3D reconstruction core.

clips -> frames (frames.py) -> VGGT predictions (reconstruct.py) -> GLB (export.py)

The pipeline is backend-agnostic: it runs against the ungated base VGGT-1B
model first, then swaps to VGGT-Omega once Hugging Face access is granted —
the choice is a single CLI flag, no code change.
"""
