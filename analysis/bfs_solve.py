"""
Rotrix BFS 最优解搜索 (单局)
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

def bfs_solve(start, target, knobs, max_depth=12):
    """Bidirectional BFS would be ideal, but let's do unidirectional first."""
    if start == target:
        return 0, []
    visited = {start: (0, None)}  # state -> (dist, (prev_state, move))
    queue = deque([start])
    while queue:
        state = queue.popleft()
        dist, _ = visited[state]
        if dist >= max_depth:
            continue
        for knob_name, cells in knobs:
            ns = apply_cw(state, cells)
            if ns not in visited:
                visited[ns] = (dist + 1, (state, knob_name))
                if ns == target:
                    # reconstruct
                    path = []
                    cur = ns
                    while visited[cur][1] is not None:
                        prev, move = visited[cur][1]
                        path.append(move)
                        cur = prev
                    path.reverse()
                    return dist + 1, path
                queue.append(ns)
    return None, None

def bidirectional_bfs(start, target, knobs, max_depth=20):
    """Bidirectional BFS for shortest path."""
    if start == target:
        return 0, []
    
    # Forward: from start
    # Backward: from target (using inverse moves = CW^3)
    def apply_cw_inverse(board, cells):
        """CCW = inverse of CW"""
        n = len(cells)
        new_board = list(board)
        old = [board[c] for c in cells]
        for i in range(n):
            new_board[cells[i]] = old[(i + 1) % n]
        return tuple(new_board)
    
    forward = {start: (0, None)}  # state -> (dist, (prev, move))
    backward = {target: (0, None)}  # state -> (dist, (prev, move_back))
    
    forward_frontier = [start]
    backward_frontier = [target]
    
    total_depth = 0
    
    while total_depth < max_depth:
        # Expand smaller frontier
        if len(forward_frontier) <= len(backward_frontier):
            # Expand forward
            new_frontier = []
            for state in forward_frontier:
                dist, _ = forward[state]
                if dist >= max_depth // 2 + 1:
                    continue
                for knob_name, cells in knobs:
                    ns = apply_cw(state, cells)
                    if ns not in forward:
                        forward[ns] = (dist + 1, (state, knob_name))
                        new_frontier.append(ns)
                        if ns in backward:
                            # Found! Reconstruct path
                            bdist = backward[ns][0]
                            fpath = []
                            cur = ns
                            while forward[cur][1] is not None:
                                prev, move = forward[cur][1]
                                fpath.append(move)
                                cur = prev
                            fpath.reverse()
                            
                            # Backward path: need to convert backward moves to forward moves
                            bpath = []
                            cur = ns
                            while backward[cur][1] is not None:
                                prev, move_back = backward[cur][1]
                                # move_back was a CCW from target direction
                                # To go from ns to target, we need CW moves
                                # backward stores: prev --CCW--> cur means target --CW--> ... --CCW--> cur
                                # So to go from cur to target: apply CW of move_back
                                bpath.append(move_back)
                                cur = prev
                            # bpath is from ns to target using CW
                            total = forward[ns][0] + backward[ns][0]
                            return total, fpath + bpath
            forward_frontier = new_frontier
            total_depth += 1
        else:
            # Expand backward (from target)
            new_frontier = []
            for state in backward_frontier:
                dist, _ = backward[state]
                if dist >= max_depth // 2 + 1:
                    continue
                for knob_name, cells in knobs:
                    # Apply CCW (inverse) to go backward
                    ns = apply_cw_inverse(state, cells)
                    if ns not in backward:
                        backward[ns] = (dist + 1, (state, knob_name))
                        new_frontier.append(ns)
                        if ns in forward:
                            # Found!
                            fdist = forward[ns][0]
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
                                prev, move_back = backward[cur][1]
                                bpath.append(move_back)
                                cur = prev
                            
                            total = forward[ns][0] + backward[ns][0]
                            return total, fpath + bpath
            backward_frontier = new_frontier
            total_depth += 1
    
    return None, None

knobs4 = build_knobs_4x4()
target4 = tuple(range(16))

print("=" * 50)
print("4x4 最优解 BFS (双向)")
print("=" * 50)

for n_scramble in [3, 5, 8, 10, 15, 20]:
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
    dist, path = bidirectional_bfs(start, target4, knobs4, max_depth=14)
    t1 = time.time()
    
    if dist is not None:
        # Verify solution
        verify_board = list(start)
        for move_name in path:
            knob = next(k for k in knobs4 if k[0] == move_name)
            verify_board = apply_cw(tuple(verify_board), knob[1])
            verify_board = list(verify_board)
        ok = tuple(verify_board) == target4
        
        print(f"  scramble={n_scramble:2d}: 最优解={dist:2d}步 (耗时{t1-t0:.2f}s) 验证={'OK' if ok else 'FAIL'}", flush=True)
        if n_scramble <= 10:
            print(f"    打乱: {scramble_moves}", flush=True)
            print(f"    求解: {path}", flush=True)
    else:
        print(f"  scramble={n_scramble:2d}: 未找到解 (max_depth=14)", flush=True)
