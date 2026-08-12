"""Analyze original_image.png layout to find sprite bounding regions."""
from PIL import Image
import numpy as np

src = r"D:\code\rotrix\original_image.png"
img = Image.open(src).convert("RGB")
arr = np.array(img)
H, W = arr.shape[:2]
print("dims", W, H)

nonwhite = ((arr[:,:,0] < 245) | (arr[:,:,1] < 245) | (arr[:,:,2] < 245)).astype(int)
row_density = nonwhite.sum(axis=1)
col_density = nonwhite.sum(axis=0)

def find_gaps(white_mask, min_gap=5):
    """Find runs of True (white) with length >= min_gap."""
    gaps = []
    i = 0
    n = len(white_mask)
    while i < n:
        if white_mask[i]:
            j = i
            while j < n and white_mask[j]:
                j += 1
            if j - i >= min_gap:
                gaps.append((i, j, j - i))
        i = j + 1 if j > i else i + 1
    return gaps

row_white = row_density < (W * 0.01)
col_white = col_density < (H * 0.01)
row_gaps = find_gaps(row_white)
col_gaps = find_gaps(col_white)

print("\n=== horizontal gaps (y) — row ranges that are all-white ===")
for g in row_gaps:
    print(f"  y={g[0]}..{g[1]} (size {g[2]})")

print("\n=== vertical gaps (x) — col ranges that are all-white ===")
for g in col_gaps:
    print(f"  x={g[0]}..{g[1]} (size {g[2]})")

# Show downsampled density
print("\n=== row density (downsampled to 80 chars) ===")
step_r = max(1, H // 80)
rd = row_density[::step_r][:80]
print("".join("#" if x > W*0.02 else ("." if x > 0 else " ") for x in rd))

print("\n=== col density (downsampled to 80 chars) ===")
step_c = max(1, W // 80)
cd = col_density[::step_c][:80]
print("".join("#" if x > H*0.02 else ("." if x > 0 else " ") for x in cd))

# Save a grid-annotated thumbnail for visual verification
thumb = img.copy()
thumb.thumbnail((400, 400))
thumb.save(r"C:\Users\Public\thumb.png")
print("\nSaved thumbnail to C:\\Users\\Public\\thumb.png")
