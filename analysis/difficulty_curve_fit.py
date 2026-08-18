"""
Rotrix 4×4 难度曲线 — 精确模型拟合（无 scipy 依赖）
使用 numpy 的 polyfit 做线性化拟合
"""
import math
import numpy as np

# ============================================================
# 实验数据
# ============================================================

N_vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
DR_vals = [
    0.0833, 0.1488, 0.2035, 0.2522, 0.2959, 0.3378, 0.3741, 0.4045, 0.4407, 0.4696,
    0.5833, 0.6605, 0.7045, 0.7410, 0.7576, 0.7694, 0.7710, 0.7756, 0.7707, 0.7660
]
ENT_vals = [
    1.0814, 1.8652, 2.4634, 2.9768, 3.3718, 3.7164, 3.9997, 4.1870, 4.4749, 4.6213,
    5.1631, 5.4836, 5.5693, 5.6391, 5.6894, 5.7182, 5.7042, 5.7230, 5.7297, 5.7275
]

TV_N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 22, 26, 30, 40, 50, 60]
TV_vals = [
    0.9999, 0.9999, 0.9975, 0.9856, 0.9661, 0.9521, 0.9198, 0.8861, 0.8487, 0.7938,
    0.7029, 0.5358, 0.4031, 0.2422, 0.1218, 0.0400, 0.0590, 0.0782, 0.0574
]

# ============================================================
# 拟合: D(N) = D_max × (1 - e^(-λN))
# 线性化: ln(1 - D(N)/D_max) = -λN
# 两阶段：先估计 D_max，再拟合 λ
# ============================================================

# 使用 N=60 的近似值作为 D_max 初始值
D_max_est = DR_vals[-1]
print(f"D_max 初始估计 (N=60): {D_max_est:.4f}")

# 线性回归拟合 λ: y = ln(1 - D(N)/D_max) = -λN
# 使用 N=1~15 的数据（避免平稳区噪声）
fit_N = np.array(N_vals[:15])
fit_DR = np.array(DR_vals[:15])

# 对 D_max 做网格搜索，找到最优值
best_r2 = -1e10
best_D_max = D_max_est
best_lambda = 0.0

for D_max_try in [d/1000 for d in range(700, 850)]:
    y = np.array([math.log(1 - min(dr/D_max_try, 0.999)) for dr in fit_DR])
    # 线性回归
    A = np.vstack([-fit_N, np.ones_like(fit_N)]).T
    coeff, residuals, rank, s = np.linalg.lstsq(A, y, rcond=None)
    lam = coeff[0]
    intercept = coeff[1]
    
    # 预测值
    y_pred = -lam * fit_N + intercept
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1 - ss_res / ss_tot
    
    if r2 > best_r2:
        best_r2 = r2
        best_D_max = D_max_try
        best_lambda = lam

D_max = best_D_max
lam = best_lambda

print(f"\n{'='*70}")
print(f"模型拟合: D(N) = D_max × (1 - e^(-λN))")
print(f"{'='*70}")
print(f"\n  D_max = {D_max:.4f}")
print(f"  λ     = {lam:.4f}")
print(f"  R²    = {best_r2:.4f}")
print(f"  τ = 1/λ = {1/lam:.2f} 步")

print(f"\n  各时间常数下的收敛程度:")
for k in [1, 2, 3, 4]:
    pct = 1 - math.exp(-k)
    steps = k * (1/lam)
    print(f"    {k}τ ({steps:.1f} 步): 达到 {pct*100:.1f}% 平稳值")

# ============================================================
# 模型验证
# ============================================================

print(f"\n\n{'='*70}")
print(f"模型验证: 各 N 下的预测值与实验值对比")
print(f"{'='*70}")
print(f"{'N':<6} {'实验值':<10} {'预测值':<10} {'误差':<10}")
print("-" * 36)
for N, dr in zip(N_vals, DR_vals):
    pred = D_max * (1 - math.exp(-lam * N))
    err = dr - pred
    print(f"{N:<6} {dr:<10.4f} {pred:<10.4f} {err:<+10.4f}")

# ============================================================
# 混合时间模型
# ============================================================

print(f"\n\n{'='*70}")
print(f"混合时间分析: TV(N) ≈ e^(-μN)")
print(f"{'='*70}")

# 用 TV 数据拟合 μ, 使用 N>=10 的数据
tv_fit_N = np.array([N for N in TV_N if N >= 10])
tv_fit_V = np.array([TV_vals[TV_N.index(N)] for N in tv_fit_N])

y = np.log(tv_fit_V)
A = np.vstack([-tv_fit_N, np.ones_like(tv_fit_N)]).T
coeff, _, _, _ = np.linalg.lstsq(A, y, rcond=None)
mu = coeff[0]

print(f"\n  μ = {mu:.4f}")
print(f"  TV(N) = e^(-{mu:.4f}N)")
print(f"  TV < 0.2 时 N > {-math.log(0.2)/mu:.1f} 步")
print(f"  TV < 0.1 时 N > {-math.log(0.1)/mu:.1f} 步")

# ============================================================
# 核心结论
# ============================================================

print(f"\n\n{'='*70}")
print(f"核心结论")
print(f"{'='*70}")

print(f"""
难度曲线数学模型: D(N) = {D_max:.3f} × (1 - e^(-{lam:.3f}N))

其中 D(N) = 色块错位率 (0~1), N = 打乱步数

┌─────────────────────────────────────────────────────┐
│  时间常数 τ = {1/lam:.1f} 步                                       │
├───────────────┬──────────┬──────────────────────────┤
│  N (打乱步数)  │ 错位率    │ 达到平稳值的百分比         │
├───────────────┼──────────┼──────────────────────────┤
""")

for N in [1, 5, 10, 15, 20, 22, 26, 30, 40]:
    pred = D_max * (1 - math.exp(-lam * N))
    pct = (1 - math.exp(-lam * N)) * 100
    print(f"│  {N:>3}           │ {pred:.4f}  │ {pct:.1f}%                        │")

print(f"└───────────────┴──────────┴──────────────────────────┘")

print(f"""
关键阈值:
  τ (63% 收敛)   = {1/lam:.0f} 步
  2τ (86% 收敛)  = {2/lam:.0f} 步
  3τ (95% 收敛)  = {3/lam:.0f} 步  ← 实用阈值: 超过此值再增加步数收效甚微
  4τ (98% 收敛)  = {4/lam:.0f} 步
  TV<0.2 (混合)  ≈ 26 步
  TV<0.1 (充分混合) ≈ {-math.log(0.1)/mu:.0f} 步

当前关卡难度评估:
  L1-L5 (N=3~12): 难度增长快 (每关 Δ≈0.06~0.09), 各关卡区分度高 ✓
  L6-L7 (N=15~18): 增速放缓 (Δ≈0.05), 仍有区分度
  L8 (N=22):      增速明显放缓 (Δ≈0.05), 接近 86% 收敛
  L9 (N=26):      增量很小 (Δ≈0.03), 已到达 TV<0.2 混合时间
  L10 (N=30):     增量极小 (Δ≈0.02), 接近 95% 收敛阈值

建议: 4×4 正方形网格的有效难度范围是 N=3~25。
      N=26~30 之后继续增加打乱步数对难度提升贡献极小。
""")

# ============================================================
# 生成 CSV 数据
# ============================================================

print("\n\n--- CSV 格式数据 ---")
print("N,DR,DR_model,ENT,ENT_norm,TV")
for i, N in enumerate(N_vals):
    dr_model = D_max * (1 - math.exp(-lam * N))
    ent_norm = ENT_vals[i] / 8.0
    tv = TV_vals[TV_N.index(N)] if N in TV_N else ""
    avg_qc = (1 - DR_vals[i]) * 4
    print(f"{N},{DR_vals[i]:.4f},{dr_model:.4f},{ENT_vals[i]:.4f},{ent_norm:.4f},{tv},{avg_qc:.2f}")

# ============================================================
# 生成绘图代码
# ============================================================

print("\n\n--- 绘图代码 (matplotlib) ---")
print("""
import matplotlib.pyplot as plt
import numpy as np

N = np.array([1,2,3,4,5,6,7,8,9,10,15,20,25,30,35,40,45,50,55,60])
DR = np.array([0.0833,0.1488,0.2035,0.2522,0.2959,0.3378,0.3741,0.4045,0.4407,0.4696,
               0.5833,0.6605,0.7045,0.7410,0.7576,0.7694,0.7710,0.7756,0.7707,0.7660])

D_max = """ + f"{D_max:.4f}" + """
lam = """ + f"{lam:.4f}" + """
DR_model = D_max * (1 - np.exp(-lam * N))

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(N, DR, 'o', label='实验数据', markersize=5, color='#2196F3')
ax.plot(N, DR_model, '-', label=f'D(N)={D_max:.3f}×(1-e^({lam:.3f}N))', linewidth=2, color='#FF5722')
ax.axhline(y=D_max, color='gray', linestyle='--', alpha=0.5, label=f'平稳值={D_max:.3f}')
ax.axvline(x=26, color='red', linestyle=':', alpha=0.5, label='TV<0.2 (N=26)')
ax.axvline(x=30, color='green', linestyle=':', alpha=0.5, label='3τ (N=30)')
ax.set_xlabel('打乱步数 N', fontsize=12)
ax.set_ylabel('色块错位率', fontsize=12)
ax.set_title('4×4 正方形网格难度曲线', fontsize=14)
ax.legend(fontsize=10)
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('difficulty_curve.png', dpi=150)
plt.show()
""")