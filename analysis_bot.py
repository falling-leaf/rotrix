"""Detailed analysis of bottom band to find pose grid."""
from PIL import Image
import numpy as np

src = r"D:\code\rotrix\original_image.png"
img = Image.open(src).convert("RGB")
arr = np.array(img)
H, W = arr.shape[:2]

nonwhite = ((arr[:,:,0] < 245) | (arr[:,:,1] < 245) | (arr[:,:,2] < 245)).astype(int)

# Bottom band: y=712..1102, but exclude left text column x<106
bot = nonwhite[712:1102, 106:1262]
print("bottom band shape (rows, cols):", bot.shape)

# row density within bottom band
bot_rows = bot.sum(axis=1)
print("\n=== bottom band row density ===")
step = max(1, len(bot_rows) // 60)
print("".join("#" if x > bot.shape[1]*0.01 else ("." if x > 0 else " ") for x in bot_rows[::step][:60]))

# col density within bottom band
bot_cols = bot.sum(axis=0)
print("\n=== bottom band col density ===")
step2 = max(1, len(bot_cols) // 80)
print("".join("#" if x > bot.shape[0]*0.01 else ("." if x > 0 else " ") for x in bot_cols[::step2][:80]))

# Find white gaps in rows (to detect 2-row layout)
row_white = bot_rows < (bot.shape[1] * 0.005)
def find_gaps(mask, min_gap=3):
    gaps = []
    i = 0
    n = len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            if j - i >= min_gap:
                gaps.append((i, j, j-i))
            i = j
        else:
            i += 1
    return gaps

row_gaps = find_gaps(row_white)
print("\n=== bottom band row gaps ===")
for g in row_gaps:
    print(f"  y={712+g[0]}..{712+g[1]} (size {g[2]})")

col_white = bot_cols < (bot.shape[0] * 0.005)
col_gaps = find_gaps(col_white)
print("\n=== bottom band col gaps ===")
for g in col_gaps:
    print(f"  x={106+g[0]}..{106+g[1]} (size {g[2]})")
