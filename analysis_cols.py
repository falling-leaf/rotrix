"""Find column boundaries within each row band."""
from PIL import Image
import numpy as np

src = r"D:\code\rotrix\original_image.png"
img = Image.open(src).convert("RGB")
arr = np.array(img)
H, W = arr.shape[:2]

nonwhite = ((arr[:,:,0] < 245) | (arr[:,:,1] < 245) | (arr[:,:,2] < 245)).astype(int)

def find_content_cols(roi_arr, threshold_frac=0.005):
    """In a horizontal ROI band, find columns with content."""
    col_d = roi_arr.sum(axis=0)
    t = roi_arr.shape[0] * threshold_frac
    has_content = col_d > t
    # find runs
    runs = []
    i = 0
    n = len(has_content)
    i = 0
    while i < n:
        if has_content[i]:
            j = i
            while j < n and has_content[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    # merge runs separated by tiny gaps (<15px)
    merged = []
    for s, e in runs:
        if merged and s - merged[-1][1] < 15:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    # drop runs < 40px wide (noise/text)
    merged = [(s, e) for s, e in merged if e - s > 40]
    return merged

# Top band: three-view
top_band = nonwhite[56:551, :]
print("=== TOP BAND (y=56..551) column content runs ===")
for s, e in find_content_cols(top_band):
    print(f"  x={s+0}..{e+0} (width {e-s})")

# Bottom band: action poses
bot_band = nonwhite[712:1102, :]
print("\n=== BOTTOM BAND (y=712..1102) column content runs ===")
for s, e in find_content_cols(bot_band):
    print(f"  x={s+0}..{e+0} (width {e-s})")

# Also detect horizontal sub-bands in the bottom (maybe 2 rows of poses?)
bot_rows = nonwhite[712:1102, :].sum(axis=1)
print("\n=== BOTTOM BAND row density ===")
step = max(1, len(bot_rows) // 60)
print("".join("#" if x > W*0.02 else ("." if x > 0 else " ") for x in bot_rows[::step][:60]))
