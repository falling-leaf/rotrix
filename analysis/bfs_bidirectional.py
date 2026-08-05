"""
Rotrix 最优解搜索 — 双向 BFS (BiBFS)
从 start 和 target 同时搜索, 在中间相遇
"""
import time
import random
import math
from collections import deque

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

def apply_ccw(board, cells):
    n = len(cells)
    new_board = list(board)
    old = [board[c] for c in cells]
    for i in range(n):
        new_board[cells[i]] = old[(i + 1) % n]
    return tuple(new_board)

def bidirectional_bfs(start, target, knobs, max_depth=30):
    """Bidirectional BFS.
    Forward: from start, applying CW
    Backward: from target, applying CCW (to find states reachable by CW from start)
    
    If a state is in both frontiers, we found a path:
      start --CW--> meeting <--CCW-- target
      which means: start --CW--> meeting --CW--> target (reverse of CCW)
    """
    if start == target:
        return 0, []
    
    forward = {start: (0, None)}   # state -> (dist, (prev, move_cw))
    backward = {target: (0, None)}  # state -> (dist, (prev, move_ccw))
    
    f_frontier = [start]
    b_frontier = [target]
    
    depth_f = 0
    depth_b = 0
    
    while depth_f + depth_b < max_depth:
        # Expand smaller frontier
        if len(f_frontier) <= len(b_frontier):
            # Expand forward
            if not f_frontier:
                break
            depth_f += 1
            new_frontier = []
            for state in f_frontier:
                for knob_name, cells in knobs:
                    ns = apply_cw(state, cells)
                    if ns not in forward:
                        forward[ns] = (depth_f, (state, knob_name))
                        new_frontier.append(ns)
                        if ns in backward:
                            # Found meeting point
                            total = depth_f + backward[ns][0]
                            # Reconstruct forward path
                            fpath = []
                            cur = ns
                            while forward[cur][1] is not None:
                                prev, move = forward[cur][1]
                                fpath.append(move)
                                cur = prev
                            fpath.reverse()
                            # Reconstruct backward path
                            # backward stores: target --CCW--> ... --CCW--> ns
                            # To go from ns to target: apply CW (reverse of CCW)
                            bpath = []
                            cur = ns
                            while backward[cur][1] is not None:
                                prev, move_ccw = backward[cur][1]
                                # move_ccw is the knob used with CCW to go from prev to cur
                                # To reverse: apply CW with same knob
                                bpath.append(move_ccw)
                                cur = prev
                            return total, fpath + bpath
            f_frontier = new_frontier
            print(f"  f_depth {depth_f}: {len(forward)} forward states", flush=True)
        else:
            # Expand backward
            if not b_frontier:
                break
            depth_b += 1
            new_frontier = []
            for state in b_frontier:
                for knob_name, cells in knobs:
                    # Apply CCW to go backward (reverse of CW)
                    ns = apply_ccw(state, cells)
                    if ns not in backward:
                        backward[ns] = (depth_b, (state, knob_name))
                        new_frontier.append(ns)
                        if ns in forward:
                            # Found meeting point
                            total = forward[ns][0] + depth_b
                            fpath = []
                            cur = ns
                            while forward[cur][1] is not None:
                                prev, move = forward[cur][1]
                                fpath.append(move)
                                cur = prev
                            fpath.reverse()
                            bpath = []
                            cur = ns
                            while backward[cur][1] is not None:
                                prev, move_ccw = backward[cur][1]
                                bpath.append(move_ccw)
                                cur = prev
                            return total, fpath + bpath
            b_frontier = new_frontier
            print(f"  b_depth {depth_b}: {len(backward)} backward states", flush=True)
    
    return None, None

# === Run ===
knobs4 = build_knobs_4x4()
target4 = tuple(range(16))

print("=" * 50)
print("4x4 最优解 双向BFS")
print("=" * 50)

for n_scramble in [3, 5, 8, 10]:
    random.seed(42 + n_scramble)
    board = list(range(16))
    scramble_moves = []
    for _ in range(n_scramble):
        knob = random.choice(knobs4)
        board = apply_cw(tuple(board), knob[1])
        board = list(board)
        scramble_moves.append(knob[0])
    
    start = tuple(board)
    
    t0 = time.time()
    dist, path = bidirectional_bfs(start, target4, knobs4, max_depth=30)
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
        if n_scramble <= 10:
            print(f"    打乱({len(scramble_moves)}步): {scramble_moves}")
            print(f"    求解({len(path)}步): {path}")
    else:
        print(f"  scramble={n_scramble:2d}: 未找到解")
    print()
