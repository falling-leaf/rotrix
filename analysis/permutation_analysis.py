"""
Rotrix 理论分析 — 置换群结构计算
分析 4x4 和 6x6 正方形拓扑下旋钮旋转操作的代数性质
"""
import sympy
from sympy.combinatorics import Permutation, PermutationGroup
import sys

def build_knobs_4x4():
    """4x4: 9 个旋钮, 每个4块, cells=[TL,TR,BR,BL] 顺时针"""
    knobs = []
    for r in range(3):
        for c in range(3):
            tl = r*4 + c
            tr = r*4 + (c+1)
            br = (r+1)*4 + (c+1)
            bl = (r+1)*4 + c
            knobs.append((f"K{r}{c}", [tl, tr, br, bl]))
    return knobs

def build_knobs_6x6():
    """6x6: 25 个旋钮"""
    knobs = []
    for r in range(5):
        for c in range(5):
            tl = r*6 + c
            tr = r*6 + (c+1)
            br = (r+1)*6 + (c+1)
            bl = (r+1)*6 + c
            knobs.append((f"K{r}{c}", [tl, tr, br, bl]))
    return knobs

def cw_permutation(cells, board_size):
    """构造一个旋钮 CW 旋转对应的全棋盘置换
    cells = [TL, TR, BR, BL] 顺时针排列
    CW: new[i] = old[(i+3)%4] => 块在位置 cells[j] 移到 cells[(j+1)%4]
    """
    n = len(cells)
    perm = list(range(board_size))
    for j in range(n):
        perm[cells[j]] = cells[(j+1) % n]
    return Permutation(perm)

def analyze_grid(name, knobs, board_size):
    print("=" * 60)
    print(f"{name} 正方形拓扑分析")
    print("=" * 60)

    print(f"\n旋钮数: {len(knobs)}")
    print(f"棋盘格数: {board_size}")

    # 构造每个旋钮的 CW 置换
    perms = []
    for knob_name, cells in knobs:
        p = cw_permutation(cells, board_size)
        perms.append((knob_name, p))

    # 构造置换群
    g = PermutationGroup([p for _, p in perms])
    print(f"\n旋钮群阶: |G| = {g.order()}")

    # 轨道
    orbits = g.orbits()
    print(f"群轨道数: {len(orbits)}")
    for i, orb in enumerate(sorted(orbits, key=lambda s: min(s))):
        print(f"  轨道{i}: {sorted(orb)} (大小 {len(orb)})")

    # 传递性
    print(f"\n是否传递(transitive): {g.is_transitive}")

    # 是否为对称群/交错群
    is_sym = g.is_symmetric
    is_alt = g.is_alternating
    print(f"是否为对称群 S_{board_size}: {is_sym}")
    print(f"是否为交错群 A_{board_size}: {is_alt}")
    print(f"是否可解群: {g.is_solvable}")

    # 群的生成元
    # 检查不变量
    print(f"\n--- 不变量分析 ---")
    # 检查奇偶性：每个 CW 是一个 4-cycle = 奇置换 (length 4 => sign = (-1)^3 = -1)
    for knob_name, p in perms[:3]:
        sign = (-1) ** (len(p.cyclic_form) and sum(len(c) - 1 for c in p.cyclic_form))
        # 更准确: 4-cycle 的符号
        parity = p.parity()
        print(f"  {knob_name}: parity={parity} (0=even, 1=odd)")

    # 所有旋钮 CW 的奇偶性
    all_odd = all(p.parity() == 1 for _, p in perms)
    all_even = all(p.parity() == 0 for _, p in perms)
    mixed = not all_odd and not all_even
    print(f"\n所有生成元为奇置换: {all_odd}")
    print(f"所有生成元为偶置换: {all_even}")
    print(f"生成元奇偶混合: {mixed}")

    return g, perms

# ===== 4x4 分析 =====
knobs4 = build_knobs_4x4()
g4, perms4 = analyze_grid("4x4", knobs4, 16)

print("\n\n")

# ===== 6x6 分析 =====
knobs6 = build_knobs_6x6()
g6, perms6 = analyze_grid("6x6", knobs6, 36)

# ===== 衍生分析: coset / 不变量 =====
print("\n" + "=" * 60)
print("不变量与可达性分析")
print("=" * 60)

# 检查 4x4: 颜色分布不变量
# 目标棋盘: 4色各4块 (4x4=16, 4色x4块)
# 打乱棋盘: 4色各4块 => 颜色分布不变(因为旋转不改变颜色计数)
# 但如果"任意打乱"意味着任意颜色分布，那可能颜色数量不对

print("\n--- 4x4 颜色分布不变量 ---")
print("目标棋盘: 4色各4块 (red=4, yellow=4, blue=4, green=4)")
print("旋转操作不改变任何颜色的计数")
print("因此: 任意颜色分布的棋盘(如全部红色)必定无解")

# 检查置换奇偶性不变量
print("\n--- 4x4 置换奇偶性不变量 ---")
# 目标棋盘 -> 打乱棋盘 的置换 sigma 的奇偶性
# 每次 CW 旋转 = 一个 4-cycle = 奇置换
# 所以 G 中元素 = k 个 4-cycle 的乘积, 奇偶性 = (-1)^k
# 但 G 是群, 生成元都是奇置换 => G 中既有奇置换也有偶置换?
# 不一定! 需要检查 G 是否包含奇置换

# 检查群中是否有奇置换
has_odd = False
has_even = False
# 遍历群的某些元素来判断
# 如果群中有奇置换, 则 G 不全在 A_n 中
# PermutationGroup 有 .contains(p) 方法

# 取一个生成元(奇置换)看它是否在群中
gen0 = perms4[0][1]
print(f"K00 (奇置换) 在群 G4 中: {g4.contains(gen0)}")
# 如果奇置换在群中, 说明群不是 A_n 的子群

# 判断群是否为 A_n 的子群
# G 是 A_n 的子群 当且仅当 所有生成元都是偶置换
# 这里生成元都是奇置换(4-cycle), 所以 G 不是 A_n 的子群
# 但是 G 可能仍不等于 S_n

# 更精确: 检查群的指数
# 如果 G = S_n, 则 [S_n : G] = 1
# 如果 G = A_n, 则 [S_n : G] = 2
# 否则更大

print(f"\n4x4: G4 是否为 S_16: {g4.is_symmetric}")
print(f"4x4: G4 是否为 A_16: {g4.is_alternating}")

# 如果既不是 S_n 也不是 A_n, 那么群更小, 存在更多不变量
if not g4.is_symmetric and not g4.is_alternating:
    print(f"4x4: G4 既非 S_16 也非 A_16")
    print(f"  [S_16 : G4] = {sympy.factorial(16) // g4.order()}")
    print(f"  存在额外的不变量(非平凡不变量)")
else:
    print(f"4x4: G4 = {'S_16' if g4.is_symmetric else 'A_16'}, 无额外置换不变量")

if not g6.is_symmetric and not g6.is_alternating:
    print(f"\n6x6: G6 既非 S_36 也非 A_36")
    print(f"  [S_36 : G6] = {sympy.factorial(36) // g6.order()}")
    print(f"  存在额外的不变量(非平凡不变量)")
else:
    print(f"\n6x6: G6 = {'S_36' if g6.is_symmetric else 'A_36'}, 无额外置换不变量")
