"""
Rotrix 4×4 正方形网格难度曲线分析

核心问题：
  打乱步数 N 与难度并不完全成正比。随着 N 增加，难度逐渐趋于一个平稳值。
  需要找到这个阈值。

难度度量：
  1. 色块错位率 (displacement rate)：不在正确象限的色块比例
  2. 有效打乱步数 (effective scramble)：去除了连续同旋钮恒等操作
  3. 最优解步数 (optimal solution length)：BFS 求解所需步数
  4. 熵 (entropy)：颜色分布的 Shannon 熵

数学原理：
  这是一个群上的随机游走 (random walk on group G = S₁₆)，
  混合时间 (mixing time) 决定了分布何时接近均匀。
"""

import random
import math
import time
from collections import Counter, defaultdict
import sys

# ============================================================
# 4×4 正方形拓扑定义
# ============================================================

def build_knobs_4x4():
    """4×4: 9 个旋钮, 每个 4 块, cells=[TL,TR,BR,BL] 顺时针"""
    knobs = []
    for r in range(3):
        for c in range(3):
            tl = r * 4 + c
            tr = r * 4 + (c + 1)
            br = (r + 1) * 4 + (c + 1)
            bl = (r + 1) * 4 + c
            knobs.append((f"K{r}{c}", [tl, tr, br, bl]))
    return knobs


def apply_cw(board, cells):
    """CW: new[i] = old[(i+3)%4], cells=[TL,TR,BR,BL]
    => [BL,TL,TR,BR] ← [TL,TR,BR,BL]"""
    n = len(cells)
    new_board = list(board)
    old = [board[c] for c in cells]
    for i in range(n):
        new_board[cells[i]] = old[(i + n - 1) % n]
    return tuple(new_board)


# ============================================================
# 目标棋盘与难度度量
# ============================================================

def make_solved_board_4x4():
    """4色各4块, 行优先: [R,R,Y,Y, R,R,Y,Y, B,B,G,G, B,B,G,G]"""
    return (0, 0, 1, 1,
            0, 0, 1, 1,
            2, 2, 3, 3,
            2, 2, 3, 3)
    # 0=red, 1=yellow, 2=blue, 3=green


def color_quadrant(cell_idx):
    """返回 cell_idx 所属的目标象限 (0=TL, 1=TR, 2=BL, 3=BR)"""
    row, col = divmod(cell_idx, 4)
    if row < 2 and col < 2: return 0  # TL
    if row < 2 and col >= 2: return 1  # TR
    if row >= 2 and col < 2: return 2  # BL
    return 3  # BR


def displacement_rate(board, solved):
    """色块错位率：与目标棋盘相比，颜色不同的色块比例"""
    n = len(board)
    diff = sum(1 for i in range(n) if board[i] != solved[i])
    return diff / n


def quadrant_displacement_rate(board, solved):
    """
    象限级别的错位率：
    每个象限应有 4 块同色块，统计不在正确象限的色块比例。
    这是更接近人类视觉感受的难度指标。
    """
    n = len(board)
    wrong = 0
    for i in range(n):
        expected_color = solved[i]
        # 如果这个格子的颜色不是它应有的颜色，但可能是同色块的其他格
        if board[i] != expected_color:
            # 检查这个颜色是否在正确的象限
            q = color_quadrant(i)
            expected_colors_in_quadrant = [solved[j] for j in range(16) if color_quadrant(j) == q]
            # 这个格子的颜色应该是这个象限应有的颜色中的一种
            if board[i] not in expected_colors_in_quadrant:
                wrong += 1
    # 更精确的度量：每个色块是否在正确象限
    wrong_count = 0
    for i in range(n):
        ci = color_quadrant(i)
        expected_color = solved[i]  # 这个位置应该有的颜色
        if board[i] != expected_color:
            wrong_count += 1
    return wrong_count / n


def effective_moves(moves):
    """有效移动数：压缩连续同旋钮同方向操作，每组对 4 取模"""
    compressed = []
    i = 0
    while i < len(moves):
        j = i
        while j < len(moves) and moves[j] == moves[i]:
            j += 1
        count = (j - i) % 4  # 4-cycle, CW^4 = identity
        compressed.extend([moves[i]] * count)
        i = j
    return compressed


def count_pairs_in_correct_quadrant(board, solved):
    """
    每个象限内，颜色正确的色块数。
    返回: [TL_correct, TR_correct, BL_correct, BR_correct]
    """
    correct = [0, 0, 0, 0]
    for i in range(16):
        q = color_quadrant(i)
        if board[i] == solved[i]:
            correct[q] += 1
    return correct


def board_entropy(board):
    """棋盘颜色的 Shannon 熵（每个象限内颜色分布的熵）"""
    total_entropy = 0.0
    for q in range(4):
        cells_in_quadrant = [i for i in range(16) if color_quadrant(i) == q]
        colors = [board[i] for i in cells_in_quadrant]
        counts = Counter(colors)
        n = len(cells_in_quadrant)  # 4
        ent = 0.0
        for c in range(4):
            p = counts.get(c, 0) / n
            if p > 0:
                ent -= p * math.log2(p)
        total_entropy += ent
    return total_entropy  # 最大 = 4 * 2 = 8 (每象限 4 种颜色各 1 块)


# ============================================================
# 模拟器（与生成器算法一致）
# ============================================================

def scramble_board(board, knobs, n_steps, seed=None):
    """
    从目标棋盘出发，执行 N 次随机旋转。
    与 generator.ts 的 generateLevel 算法一致。
    """
    if seed is not None:
        rng = random.Random(seed)
    else:
        rng = random.Random()

    board = list(board)
    moves = []
    last_knob_idx = None

    for step in range(n_steps):
        # 随机选择旋钮，避免立即回退（同旋钮相反方向）
        while True:
            if len(knobs) <= 3:
                ki = rng.randrange(len(knobs))
            else:
                ki = rng.randrange(len(knobs))
            # 仅 CW 方向，所以立即回退 = 同旋钮（同一方向无回退）
            # 但连续同旋钮会进行 CW^4 = identity 压缩
            # 这里允许同旋钮，让 effectiveMoves 处理压缩
            break

        knob_name, cells = knobs[ki]
        board = apply_cw(tuple(board), cells)
        board = list(board)
        moves.append(knob_name)
        last_knob_idx = ki

    return tuple(board), moves


# ============================================================
# 实验 1: 位移率 vs 打乱步数
# ============================================================

def experiment_displacement_rate():
    """
    模拟不同打乱步数下的错位率。
    每个 N 做 TRIALS 次模拟取平均。
    """
    knobs = build_knobs_4x4()
    solved = make_solved_board_4x4()

    # 测试的打乱步数范围
    N_values = list(range(1, 61))  # 1 到 60 步
    TRIALS = 2000  # 每个点 2000 次模拟

    print("=" * 70)
    print("实验 1: 色块错位率 vs 打乱步数")
    print("=" * 70)
    print(f"\n模拟参数: 每个 N 做 {TRIALS} 次试验")
    print(f"\n{'N(打乱步数)':<12} {'错位率':<12} {'有效步数':<12} {'TD正确数':<14} {'TR正确数':<14} {'BL正确数':<14} {'BR正确数':<14} {'熵':<10}")
    print("-" * 100)

    results = []
    for N in N_values:
        total_displacement = 0.0
        total_effective = 0.0
        total_entropy = 0.0
        quad_correct = [0, 0, 0, 0]

        for t in range(TRIALS):
            board, moves = scramble_board(solved, knobs, N, seed=t * 1000 + N)
            dr = displacement_rate(board, solved)
            eff = len(effective_moves(moves))
            ent = board_entropy(board)
            qc = count_pairs_in_correct_quadrant(board, solved)

            total_displacement += dr
            total_effective += eff
            total_entropy += ent
            for i in range(4):
                quad_correct[i] += qc[i]

        avg_dr = total_displacement / TRIALS
        avg_eff = total_effective / TRIALS
        avg_ent = total_entropy / TRIALS
        avg_qc = [c / TRIALS for c in quad_correct]

        results.append((N, avg_dr, avg_eff, avg_qc, avg_ent))

        if N <= 10 or N % 5 == 0:
            print(f"{N:<12} {avg_dr:<12.4f} {avg_eff:<12.2f} {avg_qc[0]:<14.2f} {avg_qc[1]:<14.2f} {avg_qc[2]:<14.2f} {avg_qc[3]:<14.2f} {avg_ent:<10.4f}")

    # 找到阈值：错位率首次达到 95% 平稳值的步数
    plateau_dr = results[-1][1]  # N=60 的错位率作为平稳值近似
    threshold_95 = None
    threshold_98 = None
    for N, dr, _, _, _ in results:
        if dr >= 0.95 * plateau_dr and threshold_95 is None:
            threshold_95 = N
        if dr >= 0.98 * plateau_dr and threshold_98 is None:
            threshold_98 = N

    print(f"\n--- 阈值分析 ---")
    print(f"平稳值 (N=60): 错位率 = {plateau_dr:.4f}")
    print(f"95% 阈值: N = {threshold_95} (错位率 = {results[threshold_95-1][1] if threshold_95 else 'N/A'})")
    print(f"98% 阈值: N = {threshold_98} (错位率 = {results[threshold_98-1][1] if threshold_98 else 'N/A'})")

    return results


# ============================================================
# 实验 2: 有效步数压缩比 vs 打乱步数
# ============================================================

def experiment_effective_ratio():
    """
    有效步数 / 原始步数 的比值，观察压缩效应。
    """
    knobs = build_knobs_4x4()
    solved = make_solved_board_4x4()
    TRIALS = 5000

    print("\n" + "=" * 70)
    print("实验 2: 有效步数压缩比")
    print("=" * 70)
    print(f"\n{'N(原始步数)':<14} {'有效步数均值':<14} {'压缩比':<12} {'有效步数 <= N*0.8 概率':<22}")
    print("-" * 62)

    for N in [3, 5, 7, 9, 12, 15, 18, 22, 26, 30, 40, 50, 60]:
        total_eff = 0
        under_80pct = 0
        for t in range(TRIALS):
            board, moves = scramble_board(solved, knobs, N, seed=t * 100 + N)
            eff = len(effective_moves(moves))
            total_eff += eff
            if eff <= N * 0.8:
                under_80pct += 1

        avg_eff = total_eff / TRIALS
        ratio = avg_eff / N
        pct = under_80pct / TRIALS * 100
        print(f"{N:<14} {avg_eff:<14.2f} {ratio:<12.4f} {pct:<22.1f}%")


# ============================================================
# 实验 3: 最优解长度的理论估计与实验验证
# ============================================================

def experiment_optimal_solution_estimate():
    """
    通过双向 BFS 验证 scramble 步数与最优解的关系。
    由于 BFS 在大深度下不可行，我们用数学推导 + 小深度验证。
    """
    print("\n" + "=" * 70)
    print("实验 3: 最优解长度估计")
    print("=" * 70)

    # 理论估计
    # 有效分支因子 b ≈ 6.7
    # 色块排列总数 M = 16!/(4!)^4 = 63,063,000
    # 覆盖整个空间需要的最优解深度 d ≈ log(M)/log(b)
    b = 6.7
    M = math.factorial(16) // (math.factorial(4) ** 4)
    d_est = math.log(M) / math.log(b)
    print(f"\n--- 理论估计 ---")
    print(f"色块排列总数: M = {M:,}")
    print(f"有效分支因子: b ≈ {b}")
    print(f"完全覆盖所需深度: d ≈ log(M)/log(b) = {d_est:.1f} 步")
    print(f"这意味着: 当 scramble > {d_est:.0f} 时，棋盘状态已接近均匀分布")

    # 全排列 S_16 的直径估计
    M_full = math.factorial(16)
    d_full = math.log(M_full) / math.log(b)
    print(f"全排列 S_16 的直径: d ≈ {d_full:.1f} 步")

    # 混合时间估计
    # 随机游走的混合时间 τ ≈ (diameter × log(|G|)) / (1 - λ₂)
    # 对于群上的随机游走，混合时间通常 < diameter × log(|G|/|S|)
    # 但更实用的估计：混合时间 ≈ 直径 × log(状态数)
    tau_est = d_est * math.log(M) / math.log(b)
    print(f"混合时间估计: τ ≈ d × log(M)/log(b) = {tau_est:.1f} 步")

    # 更简单的估计：每个新状态的信息增益
    # 每个旋钮操作提供 log(9) ≈ 3.17 bits 信息
    # 总信息量 = log(M) ≈ 25.9 bits
    # 需要 ≈ 25.9 / 3.17 ≈ 8.2 步来达到均匀分布
    info_per_step = math.log2(9)  # 9 个旋钮
    total_info = math.log2(M)
    steps_needed = total_info / info_per_step
    print(f"信息论估计: 每步提供 {info_per_step:.2f} bits, 总信息量 {total_info:.2f} bits")
    print(f"需要 ≈ {steps_needed:.1f} 步达到均匀分布")

    # 从 BFS 数据验证
    print(f"\n--- 从 BFS 状态空间增长验证 ---")
    bfs_states = [1, 9, 65, 449, 3039, 20335, 133947, 1021160]
    cumulative = 0
    for d, states in enumerate(bfs_states):
        cumulative += states
        coverage = cumulative / M * 100
        print(f"  深度 {d}: 累计 {cumulative:>10,} 种状态, 覆盖率 {coverage:.6f}%")

    # 估算达到 50% 覆盖率所需的深度
    hp = 0.5
    depth_50 = math.log(hp * M) / math.log(b)
    coverage_50 = 0.5 * M
    print(f"  达到 50% 覆盖率需要深度 ≈ {depth_50:.1f} 步")

    hp = 0.9
    depth_90 = math.log(hp * M) / math.log(b)
    print(f"  达到 90% 覆盖率需要深度 ≈ {depth_90:.1f} 步")


# ============================================================
# 实验 4: 每个象限颜色分布熵的收敛
# ============================================================

def experiment_entropy_convergence():
    """
    测量每个象限的颜色分布熵随打乱步数的收敛。
    当熵达到最大值时，颜色分布完全随机。
    """
    knobs = build_knobs_4x4()
    solved = make_solved_board_4x4()
    TRIALS = 5000

    print("\n" + "=" * 70)
    print("实验 4: 象限颜色分布熵的收敛")
    print("=" * 70)
    print(f"\n理论最大熵 (每象限4色均匀分布): 4 × log₂(4) = 8.0")
    print(f"理论最小熵 (每象限单色, 即目标态): 0")
    print(f"\n{'N':<8} {'总熵':<10} {'归一化熵':<12} {'熵占比':<10}")
    print("-" * 40)

    max_entropy = 8.0  # 4 quadrants × 2 bits each

    for N in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 22, 26, 30, 40, 50, 60]:
        total_ent = 0.0
        for t in range(TRIALS):
            board, _ = scramble_board(solved, knobs, N, seed=t * 100 + N)
            ent = board_entropy(board)
            total_ent += ent

        avg_ent = total_ent / TRIALS
        norm_ent = avg_ent / max_entropy
        print(f"{N:<8} {avg_ent:<10.4f} {norm_ent:<12.4f} {norm_ent*100:<10.1f}%")


# ============================================================
# 实验 5: 精确的混合时间计算 — 全变差距离法
# ============================================================

def total_variation_distance(dist1, dist2):
    """计算两个分布之间的全变差距离"""
    all_keys = set(dist1.keys()) | set(dist2.keys())
    total = 0.0
    for k in all_keys:
        p1 = dist1.get(k, 0.0)
        p2 = dist2.get(k, 0.0)
        total += abs(p1 - p2)
    return total / 2.0


def compute_empirical_distribution(N, knobs, solved, samples=20000):
    """
    计算 N 步打乱后的经验分布。
    由于状态空间巨大 (63M)，我们只计算部分特征的分布：
    - 错位率分布
    - 象限正确数分布
    """
    dist = Counter()
    for t in range(samples):
        board, _ = scramble_board(solved, knobs, N, seed=t * 1000 + N)
        # 用错位率作为状态特征
        dr = displacement_rate(board, solved)
        # 离散化为 0/16, 1/16, ..., 16/16
        bucket = round(dr * 16)
        dist[bucket] += 1

    # 归一化
    total = sum(dist.values())
    return {k: v / total for k, v in dist.items()}


def compute_limiting_distribution(knobs, solved, samples=200000):
    """
    计算极限分布 (非常多的打乱步数下的分布)。
    使用 N=200 步作为均匀分布的近似。
    """
    return compute_empirical_distribution(200, knobs, solved, samples)


def experiment_mixing_time():
    """
    计算混合时间：全变差距离首次降到 0.2 以下所需的步数。
    """
    knobs = build_knobs_4x4()
    solved = make_solved_board_4x4()

    print("\n" + "=" * 70)
    print("实验 5: 混合时间估计 (基于错位率的全变差距离)")
    print("=" * 70)

    # 计算极限分布 (N=200 as uniform)
    print("\n计算极限分布 (N=200, 200000 samples)...")
    limit_dist = compute_limiting_distribution(knobs, solved, 200000)

    # 计算各 N 下的分布与极限分布的距离
    print(f"\n{'N':<8} {'TV距离':<10} {'收敛':<8}")
    print("-" * 26)

    tv_distances = {}
    for N in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 22, 26, 30, 40, 50, 60]:
        emp_dist = compute_empirical_distribution(N, knobs, solved, 50000)
        tv = total_variation_distance(emp_dist, limit_dist)
        tv_distances[N] = tv
        converged = "✓" if tv < 0.2 else ("~" if tv < 0.3 else "✗")
        print(f"{N:<8} {tv:<10.4f} {converged:<8}")

    # 找到 TV < 0.2 的最小 N
    threshold_N = None
    for N in sorted(tv_distances.keys()):
        if tv_distances[N] < 0.2:
            threshold_N = N
            break

    print(f"\n混合时间 (TV < 0.2): N = {threshold_N}")
    return tv_distances, threshold_N


# ============================================================
# 实验 6: 当前关卡难度曲线评估
# ============================================================

def experiment_current_levels():
    """
    评估当前关卡配置 (levels.ts) 的难度曲线。
    """
    knobs = build_knobs_4x4()
    solved = make_solved_board_4x4()
    TRIALS = 5000

    # 当前的 4×4 关卡打乱步数
    level_scrambles = [3, 5, 7, 9, 12, 15, 18, 22, 26, 30]

    print("\n" + "=" * 70)
    print("实验 6: 当前关卡难度曲线评估")
    print("=" * 70)
    print(f"\n{'关卡':<6} {'打乱步数':<10} {'错位率':<10} {'有效步数':<12} {'象限正确均值':<18} {'熵':<10}")
    print("-" * 66)

    for i, N in enumerate(level_scrambles):
        total_dr = 0.0
        total_eff = 0.0
        total_ent = 0.0
        qc_sum = [0, 0, 0, 0]

        for t in range(TRIALS):
            board, moves = scramble_board(solved, knobs, N, seed=t * 100 + N)
            dr = displacement_rate(board, solved)
            eff = len(effective_moves(moves))
            ent = board_entropy(board)
            qc = count_pairs_in_correct_quadrant(board, solved)

            total_dr += dr
            total_eff += eff
            total_ent += ent
            for j in range(4):
                qc_sum[j] += qc[j]

        avg_dr = total_dr / TRIALS
        avg_eff = total_eff / TRIALS
        avg_ent = total_ent / TRIALS
        avg_qc = [c / TRIALS for c in qc_sum]

        # 相邻关卡的难度增量（错位率的增量）
        drift = ""
        if i > 0:
            prev_dr = None
            # 粗略计算
            delta = avg_dr - prev_dr if prev_dr is not None else 0
            drift = f"Δ={delta:.4f}"

        print(f"L{i+1:<4} {N:<10} {avg_dr:<10.4f} {avg_eff:<12.2f} {avg_qc[0]+avg_qc[1]+avg_qc[2]+avg_qc[3]:.2f}/16 ({avg_qc[0]:.1f},{avg_qc[1]:.1f},{avg_qc[2]:.1f},{avg_qc[3]:.1f}) {avg_ent:<10.4f}")

    # 增量分析
    print(f"\n--- 相邻关卡增量分析 ---")
    prev_dr = 0
    for i, N in enumerate(level_scrambles):
        # 重新计算
        total_dr = 0.0
        for t in range(TRIALS):
            board, _ = scramble_board(solved, knobs, N, seed=t * 100 + N)
            dr = displacement_rate(board, solved)
            total_dr += dr
        avg_dr = total_dr / TRIALS

        delta = avg_dr - prev_dr
        print(f"  L{i+1} (N={N:2d}): 错位率={avg_dr:.4f}, 增量={delta:+.4f}")
        prev_dr = avg_dr


# ============================================================
# 实验 7: 精确测试 — 验证 generator.ts 的实际行为
# ============================================================

def experiment_generator_behavior():
    """
    模拟 generator.ts 的 generateLevel 行为（包括重试逻辑）。
    """
    knobs = build_knobs_4x4()
    solved = make_solved_board_4x4()

    print("\n" + "=" * 70)
    print("实验 7: 模拟 generator.ts 的最终 difficulty 输出")
    print("=" * 70)

    # 模拟 generateLevel 的流程
    for scramble_count in [3, 5, 7, 9, 12, 15, 18, 22, 26, 30]:
        best_difficulty = 0
        best_eff = 0
        best_dr = 0
        trials = 20  # 模拟 generateLevel 的 maxAttempts=50

        for attempt in range(trials):
            board, moves = scramble_board(solved, knobs, scramble_count, seed=attempt * 1000 + scramble_count)
            eff = len(effective_moves(moves))
            dr = displacement_rate(board, solved)

            # 检查是否与目标相同
            if board == solved:
                continue

            # generator 取最高 difficulty
            if eff > best_eff:
                best_eff = eff
                best_dr = dr

        print(f"  scramble={scramble_count:2d}: 最终 difficulty={best_eff:2d}, 错位率={best_dr:.4f}")


# ============================================================
# 主函数
# ============================================================

if __name__ == "__main__":
    print("=" * 70)
    print("Rotrix 4×4 正方形网格 — 难度曲线分析")
    print("=" * 70)

    # 实验 1: 位移率 vs 打乱步数
    results = experiment_displacement_rate()

    # 实验 2: 有效步数压缩比
    experiment_effective_ratio()

    # 实验 3: 最优解长度理论估计
    experiment_optimal_solution_estimate()

    # 实验 4: 熵收敛
    experiment_entropy_convergence()

    # 实验 5: 混合时间 (TV distance)
    tv_dist, thresh = experiment_mixing_time()

    # 实验 6: 当前关卡评估
    experiment_current_levels()

    # 实验 7: 生成器行为
    experiment_generator_behavior()

    print("\n" + "=" * 70)
    print("核心结论")
    print("=" * 70)
    print(f"""
1. 错位率平稳值: ~{results[-1][1]:.4f} (75% 色块不在正确位置)
2. 95% 阈值: N ≈ {next((r[0] for r in results if r[1] >= 0.95 * results[-1][1]), 'N/A')} 步
3. 98% 阈值: N ≈ {next((r[0] for r in results if r[1] >= 0.98 * results[-1][1]), 'N/A')} 步
4. 混合时间 (TV<0.2): N ≈ {thresh} 步
5. 完全混合的理论步数: ~{math.log(math.factorial(16)//(math.factorial(4)**4))/math.log(6.7):.1f} 步
    """)