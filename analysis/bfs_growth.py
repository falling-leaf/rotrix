"""
Rotrix BFS 状态空间增长 (高效版)
用整数编码状态, 集合去重
"""
import time
import sys
from collections import deque
import math

def build_knobs_4x4():
    knobs = []
    for r in range(3):
        for c in range(3):
            tl = r*4 + c
            tr = r*4 + (c+1)
            br = (r+1)*4 + (c+1)
            bl = (r+1)*4 + c
            knobs.append((f"K{r}{c}", [tl, tr, br, bl]))
    return knobs

def apply_cw(board, cells):
    n = len(cells)
    new_board = list(board)
    old = [board[c] for c in cells]
    for i in range(n):
        new_board[cells[i]] = old[(i + n - 1) % n]
    return tuple(new_board)

def bfs_growth(start, knobs, max_depth):
    """BFS counting states at each depth. Uses set for visited."""
    visited = set()
    visited.add(start)
    current = [start]
    counts = [1]
    for depth in range(1, max_depth + 1):
        next_level = set()
        for state in current:
            for knob_name, cells in knobs:
                ns = apply_cw(state, cells)
                if ns not in visited:
                    visited.add(ns)
                    next_level.add(ns)
        counts.append(len(next_level))
        current = list(next_level)
        print(f"  depth {depth:2d}: {len(next_level):>10d} new (cumulative: {len(visited):>10d})", flush=True)
        if not next_level:
            break
    return counts

# === 4x4 排列 BFS ===
knobs4 = build_knobs_4x4()
target4 = tuple(range(16))

print("=" * 50)
print("4x4 BFS 状态空间增长 (排列)")
print("=" * 50)
t0 = time.time()
counts = bfs_growth(target4, knobs4, max_depth=6)
t1 = time.time()
print(f"\n总耗时: {t1-t0:.1f}s")
print(f"累计状态数: {sum(counts)}")
print(f"16! = {math.factorial(16)}")

# === 4x4 颜色 BFS ===
print("\n" + "=" * 50)
print("4x4 BFS 状态空间增长 (颜色)")
print("=" * 50)
color_target = tuple([0]*4 + [1]*4 + [2]*4 + [3]*4)
t0 = time.time()
ccounts = bfs_growth(color_target, knobs4, max_depth=6)
t1 = time.time()
print(f"\n总耗时: {t1-t0:.1f}s")
print(f"累计状态数: {sum(ccounts)}")
total_color = math.factorial(16) // (math.factorial(4) ** 4)
print(f"4色各4块总排列数: 16!/(4!)^4 = {total_color}")
