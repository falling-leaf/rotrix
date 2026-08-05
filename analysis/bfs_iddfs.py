"""
Rotrix 最优解搜索 — IDDFS (迭代加深深度优先)
内存友好, 适合较大深度搜索
"""
import time
import random
import math
import sys

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

def iddfs(start, target, knobs, max_depth=20):
    """Iterative deepening DFS. Returns (depth, path) or (None, None)."""
    if start == target:
        return 0, []
    
    for depth_limit in range(1, max_depth + 1):
        result = _dfs(start, target, knobs, depth_limit, [], set())
        if result is not None:
            return depth_limit, result
        print(f"  depth {depth_limit}: no solution", flush=True)
    return None, None

def _dfs(state, target, knobs, depth_limit, path, visited):
    if depth_limit == 0:
        return [] if state == target else None
    
    for knob_name, cells in knobs:
        # Pruning: skip if same knob as last move (redundant: CW^4=id)
        if path and path[-1] == knob_name:
            # 3 consecutive same knob = CW^3 = CCW, 4 = identity
            # Still might be useful, but CW^4 on same knob is waste
            count = 0
            for p in reversed(path):
                if p == knob_name:
                    count += 1
                else:
                    break
            if count >= 3:
                continue  # CW^4 = identity, skip
        
        ns = apply_cw(state, cells)
        path.append(knob_name)
        result = _dfs(ns, target, knobs, depth_limit - 1, path, visited)
        if result is not None:
            return list(path)
        path.pop()
    return None

# Better: use BFS with limited depth but check early
def bfs_limited(start, target, knobs, max_depth=12):
    """BFS with depth limit. Returns (depth, path)."""
    if start == target:
        return 0, []
    
    visited = {start: (0, None)}
    queue = [start]
    
    for depth in range(1, max_depth + 1):
        next_queue = []
        for state in queue:
            dist = visited[state][0]
            for knob_name, cells in knobs:
                ns = apply_cw(state, cells)
                if ns not in visited:
                    visited[ns] = (dist + 1, (state, knob_name))
                    if ns == target:
                        path = []
                        cur = ns
                        while visited[cur][1] is not None:
                            prev, move = visited[cur][1]
                            path.append(move)
                            cur = prev
                        path.reverse()
                        return dist + 1, path
                    next_queue.append(ns)
        queue = next_queue
        print(f"  depth {depth}: {len(visited)} states visited", flush=True)
        if not queue:
            break
    return None, None

# === Run ===
knobs4 = build_knobs_4x4()
target4 = tuple(range(16))

print("=" * 50)
print("4x4 最优解 BFS")
print("=" * 50)

for n_scramble in [3]:
    random.seed(42 + n_scramble)
    board = list(range(16))
    scramble_moves = []
    for _ in range(n_scramble):
        knob = random.choice(knobs4)
        board = apply_cw(tuple(board), knob[1])
        board = list(board)
        scramble_moves.append(knob[0])
    
    start = tuple(board)
    
    # With only CW, inverse of one CW = CW^3, so optimal solution
    # could be up to 3x the scramble length
    t0 = time.time()
    dist, path = bfs_limited(start, target4, knobs4, max_depth=9)
    t1 = time.time()
    
    if dist is not None:
        # Verify
        verify_board = list(start)
        for move_name in path:
            knob = next(k for k in knobs4 if k[0] == move_name)
            verify_board = apply_cw(tuple(verify_board), knob[1])
            verify_board = list(verify_board)
        ok = tuple(verify_board) == target4
        
        print(f"  scramble={n_scramble:2d}: 最优解={dist:2d}步 (耗时{t1-t0:.2f}s) 验证={'OK' if ok else 'FAIL'}")
        print(f"    打乱({len(scramble_moves)}步): {scramble_moves}")
        print(f"    求解({len(path)}步): {path}")
    else:
        print(f"  scramble={n_scramble:2d}: 未找到解 (max_depth=9)")
    print()
