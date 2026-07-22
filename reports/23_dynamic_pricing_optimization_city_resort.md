# 23 — Dynamic Pricing Optimization: Elasticity × Forecast (City vs Resort)

> **Loại:** Báo cáo khoa học kỹ thuật (IMRAD) · recommend-only  
> **Đầu vào:** Forecast Demand/ADR/RevPAR (`20`/`20a`/`20b`) · $\varepsilon$ primary (`22`)  
> **Horizon:** 2017-09 → 2018-02 (6 tháng minh họa)  
> **Notebook:** [`notebooks/23_dynamic_pricing_optimization_city_resort.ipynb`](../notebooks/23_dynamic_pricing_optimization_city_resort.ipynb)  
> **Figures:** [`reports/figures/23_optimization/`](./figures/23_optimization/)  
> **Đầu ra chính:** [`optimal_rate_plan.csv`](./figures/23_optimization/optimal_rate_plan.csv)  
> **Cập nhật:** 22/07/2026

---

## Abstract

This report converts property-specific demand, ADR, and RevPAR forecasts into an optimal monthly BAR plan by maximizing a revenue proxy under local-linear demand calibrated to the primary elasticities from notebook 22. For each month on the September 2017–February 2018 horizon, a grid search over $p \in [0.70\,P_0,\,1.30\,P_0]$ selected $p^{\star}$ that maximized $R(p)=p\cdot Q(p)$ subject to a soft capacity of $1.15\times$ forecast demand, with the search reference tilted by blended forecast pressure. City Hotel received a uniform RAISE action of $+21.4\%$ relative to ADR forecast, lifting proxy revenue by about $+3.2\%$ per month. Resort Hotel received a uniform CUT action of $-4.5\%$, lifting proxy revenue by about $+0.23\%$ per month. The opposite signed recommendations formalize the operational asymmetry already visible in forecast stance: protect urban rates while stimulating the resort through the winter trough.

---

## 1. Introduction

Forecast notebooks 20–20b establish what volume and rate are expected under a seasonal baseline, and notebook 22 supplies the slope that links rate changes to quantity. Without an explicit optimization step, revenue managers must translate those signals qualitatively. The present study closes that gap by solving a constrained monthly revenue-maximization problem that returns a transparent $p^{\star}$, percentage delta versus forecast ADR, and a discrete action label (RAISE / CUT / HOLD).

The central research question is whether property-specific elasticities and pressure indices produce materially different BAR recommendations on the same six-month horizon. Prior synthesis (report 21) already showed that Resort ADR and RevPAR fall earlier and deeper than City after September; optimization tests whether that timing asymmetry survives when revenue is maximized under the published elasticities.

---

## 2. Methods

### 2.1 Inputs

For each hotel and month $t$ on the horizon, the optimizer consumed ADR forecast $P_0$, demand forecast $Q_0$, RevPAR forecast, and pressure indices $\pi_{\mathrm{demand}}$, $\pi_{\mathrm{ADR}}$, $\pi_{\mathrm{RevPAR}}$ from the primary models in notebooks 20, 20a, and 20b. Primary elasticities were $\varepsilon_{\mathrm{City}}=-0.70$ and $\varepsilon_{\mathrm{Resort}}=-1.10$ from `elasticity_by_hotel.csv`.

### 2.2 Demand response and objective

A pure iso-elastic curve $Q(p)=Q_0(p/P_0)^{\varepsilon}$ with $|\varepsilon|<1$ pushes the unconstrained optimum to the upper price bound and yields little calendar nuance. The implemented local-linear approximation therefore was

$$
Q(p)=Q_0\left(1+\varepsilon\frac{p-P_0}{P_0}\right),
$$

clipped below at $0.05\,Q_0$ and capped at soft capacity $Q_{\mathrm{cap}}=1.15\,Q_0$. Revenue proxy was $R(p)=p\cdot\min\{Q(p),Q_{\mathrm{cap}}\}$.

### 2.3 Pressure tilt and grid search

Blended pressure $\bar{\pi}$ was the mean of the three series pressures. The reference rate before search was

$$
P_{\mathrm{ref}}=P_0\cdot\mathrm{clip}(0.70+0.30\,\bar{\pi},\,0.80,\,1.20).
$$

Candidate prices were evaluated on a dense grid inside $[0.70\,P_0,\,1.30\,P_0]$. An analytic check $p_{\mathrm{analytic}}=P_0(\varepsilon-1)/(2\varepsilon)$ for $\varepsilon<0$ was stored for diagnostics. Actions were labeled RAISE if $\Delta p\ge +3\%$, CUT if $\Delta p\le -3\%$, and HOLD otherwise, where $\Delta p=100(p^{\star}/P_0-1)$.

---

## 3. Results

### 3.1 Optimal rate path versus forecast ADR

Figure 1 overlays forecast ADR ($P_0$) and optimal BAR ($p^{\star}$) by hotel. City $p^{\star}$ lies strictly above $P_0$ in every month, whereas Resort $p^{\star}$ lies strictly below $P_0$. The gap widens in absolute euros when City ADR is high (September) and when Resort ADR collapses (October–January), but the percentage move is nearly constant within each hotel because the local-linear optimum scales with $P_0$ under fixed $\varepsilon$.

![Figure 1. Forecast ADR versus optimal BAR](./figures/23_optimization/compare/01_p0_vs_pstar.png)

*Figure 1. Monthly $P_0$ (ADR forecast) and $p^{\star}$ (optimal BAR) for City Hotel and Resort Hotel, September 2017–February 2018.*

### 3.2 Percentage price deltas and action summary

Figure 2 shows $\Delta p$ by month. City locked at $+21.375\%$ every month (analytic optimum for $\varepsilon=-0.70$ is $P_0(\varepsilon-1)/(2\varepsilon)\approx 1.214\,P_0$). Resort locked at $-4.5\%$ every month (analytic optimum for $\varepsilon=-1.10$ is $\approx 0.955\,P_0$). Consequently the discrete action never flips within hotel over this horizon.

![Figure 2. Optimal percentage price change](./figures/23_optimization/compare/02_delta_price_pct.png)

*Figure 2. Optimal $\Delta$ price (%) relative to ADR forecast; green/red bars encode RAISE versus CUT.*

**Table 1.** Action summary across the six-month horizon

| Hotel | Dominant action | $n$ months | Mean $\Delta p$ (%) | Mean $\Delta$ revenue (%) |
|---|---|---:|---:|---:|
| City Hotel | RAISE | 6 | **+21.38** | **+3.21** |
| Resort Hotel | CUT | 6 | **−4.50** | **+0.23** |

### 3.3 Side-by-side rate plan

**Table 2.** City versus Resort optimal plan (selected columns)

| Month | City $P_0$ (€) | City $p^{\star}$ (€) | City action | Resort $P_0$ (€) | Resort $p^{\star}$ (€) | Resort action |
|---|---:|---:|---|---:|---:|---|
| 2017-09 | 133.81 | 162.41 | RAISE | 117.22 | 111.95 | CUT |
| 2017-10 | 123.07 | 149.38 | RAISE | 70.37 | 67.20 | CUT |
| 2017-11 | 108.55 | 131.75 | RAISE | 52.53 | 50.17 | CUT |
| 2017-12 | 106.62 | 129.41 | RAISE | 71.41 | 68.20 | CUT |
| 2018-01 | 98.20 | 119.19 | RAISE | 52.09 | 49.75 | CUT |
| 2018-02 | 100.51 | 121.99 | RAISE | 57.75 | 55.15 | CUT |

### 3.4 Revenue curve for the Oct phase-shift month

Figure 3 plots the October 2017 revenue curve for both hotels, marking $P_0$, $p^{\star}$, and the analytic reference. October is the month where forecast stance already diverges sharply (City still near neutral on ADR/RevPAR while Resort enters STIMULATE). The optimized Resort cut remains modest (−4.5%), illustrating that elasticity-driven stimulation need not equal deep discounting when capacity soft-caps bind and $|\varepsilon|$ is only slightly above one.

![Figure 3. October 2017 revenue curves](./figures/23_optimization/compare/03_revenue_curve_oct2017.png)

*Figure 3. Proxy revenue $R(p)$ versus BAR for October 2017, highlighting $P_0$ and $p^{\star}$ for each hotel.*

### 3.5 Comparison with forecast stance

Forecast stance (PROTECT / NEUTRAL / STIMULATE) varies by month and series, whereas the optimizer’s discrete action is constant within hotel under fixed $\varepsilon$. Months with STIMULATE stance at City (for example December–January on demand/RevPAR) still receive RAISE because inelastic demand makes higher BAR revenue-dominant inside the ±30% band. This tension is intentional: stance communicates seasonal pressure narrative, while $p^{\star}$ communicates the local revenue optimum given the published elasticity. Operational practice should reconcile conflicts by protecting an ADR floor and checking true occupancy before locking either signal alone.

---

## 4. Discussion

The opposite signed City RAISE versus Resort CUT pattern is the principal managerial result. It does not arise from month-to-month re-estimation of $\varepsilon$; it arises because City is parameterized as inelastic and Resort as mildly elastic. Percentage deltas are therefore nearly invariant across the horizon, while absolute euro recommendations inherit the ADR forecast path—including the Resort October–January collapse documented in report 21.

Pressure tilting adjusts the search reference but does not overturn the analytic sign of $p^{\star}-P_0$ when $\varepsilon$ is held fixed. Richer month-varying elasticities, competitive set constraints, or a binding rooms-available capacity would be required to produce within-hotel action flips. Until then, the calendar value of notebook 23 lies mainly in translating forecast $P_0$ into a disciplined band around a property-specific optimum rather than in inventing a new monthly action alphabet.

Limitations are material. Demand response is a local-linear proxy without competitive rates or cancellation feedback. Soft capacity at $1.15\times Q_0$ is not physical inventory. The 2018 horizon is illustrative because the source dataset ends in August 2017. All outputs remain recommend-only pending pickup validation.

---

## 5. Conclusions

Under primary elasticities from notebook 22 and forecasts from notebooks 20–20b, revenue-maximizing BAR optimization recommends a persistent City RAISE of approximately $+21\%$ and a persistent Resort CUT of approximately $-4.5\%$ on the six-month illustration horizon, with proxy revenue gains of $+3.2\%$ and $+0.23\%$, respectively. The plan formalizes a two-track rate calendar: harden City BAR relative to forecast while stimulating Resort through the winter ADR trough. Downstream ensemble logic in notebook 24 should treat these $p^{\star}$ values as one vote among forecast stance and machine-learning BAR signals rather than as a sole lock.

---

## References (project artifacts)

1. Notebook source: `notebooks/23_dynamic_pricing_optimization_city_resort.ipynb`  
2. Outputs: `optimal_rate_plan.csv`, `action_summary.csv`, `compare/city_vs_resort_rate_plan.csv`  
3. Elasticity input: `reports/figures/22_elasticity/elasticity_by_hotel.csv`  
4. Forecast inputs: `reports/figures/20/`, `20_adr/`, `20_revpar/`

---

*Báo cáo sinh theo khung scientific-writing (IMRAD) từ `notebooks/23_dynamic_pricing_optimization_city_resort.ipynb`. Cập nhật: 22/07/2026.*
