"""Cost and unit-economics model for Cylosof + Cyclowareness (USD, annual)."""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")

FX = 1.70  # AZN per USD (peg)

# --- Team: role, headcount, gross monthly salary AZN
team = [
    ("CTO / baş arxitekt", 1, 7000),
    ("Senior full-stack", 2, 5500),
    ("Middle full-stack", 1, 3500),
    ("DevOps / SRE və təhlükəsizlik", 1, 5000),
    ("QA mühəndisi", 1, 2500),
    ("Dizayner (Rive, illüstrasiya)", 1, 3500),
    ("Məzmun: red team müəllifi və təlim dizayneri", 2, 3500),
    ("Təhdid kəşfiyyatı / SOC analitiki", 1, 4000),
    ("Satış və BD (regional)", 2, 4000),
    ("Müştəri uğuru və dəstək", 2, 2500),
    ("Maliyyə, hüquq, inzibati", 1, 2500),
]


def employer_cost_azn(g):
    """2026 AZ private non-oil employer contributions on gross monthly g."""
    ss = 0.22 * min(g, 200) + 0.15 * max(0, min(g, 8000) - 200) + 0.11 * max(0, g - 8000)
    unemp = 0.005 * g
    med = 0.02 * min(g, 2500) + 0.005 * max(0, g - 2500)
    return ss + unemp + med


rows = []
team_total_usd = 0
heads = 0
for role, n, g in team:
    ec = employer_cost_azn(g)
    annual_usd = n * (g + ec) * 12 / FX
    team_total_usd += annual_usd
    heads += n
    rows.append({"role": role, "n": n, "gross_azn": g, "employer_azn": round(ec), "annual_usd": round(annual_usd)})

other = {
    "İnfrastruktur bazası (EU region, ehtiyat, staging, monitorinq)": 18000,
    "Alət və lisenziyalar": 12000,
    "Ofis (Bakı)": 24000,
    "ISO 27001 sertifikatı, audit, pentest": 35000,
    "Hüquq, mühasibat, ticarət nişanı": 25000,
    "Marketinq, sərgilər, səyahət": 90000,
    "Yeni dərs dilləri (ildə 2 dil)": 50000,
}
other_total = sum(other.values())
subtotal = team_total_usd + other_total
contingency = 0.10 * subtotal
fixed = subtotal + contingency

# --- Variable cost per paid user per month
var = {"infra": 0.04, "ai": 0.02, "email": 0.005}
var_pu_m = sum(var.values())
bank_fee = 0.01        # of revenue
partner_share = 0.25   # of revenue, partner-sourced deals
sales_comm = 0.08      # of first-year ACV, direct deals


def contrib_per_user_year(price_m, channel):
    rev = price_m * 12
    c = rev * (1 - bank_fee) - var_pu_m * 12
    if channel == "partner":
        c -= rev * partner_share
    else:
        c -= rev * sales_comm
    return c


be = {}
for p in (1.0, 1.5, 2.0, 2.5, 3.0, 4.0):
    be[p] = {ch: round(fixed / contrib_per_user_year(p, ch)) for ch in ("direct", "partner")}

# Break-even curve: annual profit vs paid seats at $2 (blend 50/50 direct/partner)
blend = lambda p: 0.5 * contrib_per_user_year(p, "direct") + 0.5 * contrib_per_user_year(p, "partner")
curve = []
for seats in range(0, 80001, 5000):
    curve.append({"seats": seats,
                  "p150": round(seats * blend(1.5) - fixed),
                  "p200": round(seats * blend(2.0) - fixed),
                  "p300": round(seats * blend(3.0) - fixed)})

# 4000-seat quote
list_prices = {"Essentials": 2.00, "Professional": 3.00, "Enterprise HRM": 4.00}
vol_disc = 0.35  # band 2,501-5,000
quote = {}
for t, lp in list_prices.items():
    net_m = lp * (1 - vol_disc)
    acv = net_m * 12 * 4000
    quote[t] = {"list_m": lp, "net_m": round(net_m, 2), "acv": round(acv),
                "contrib_direct": round(4000 * contrib_per_user_year(net_m, "direct")),
                "share_of_fixed": round(4000 * contrib_per_user_year(net_m, "direct") / fixed * 100, 1)}

out = {"heads": heads, "team_usd": round(team_total_usd), "other_usd": other_total, "contingency": round(contingency),
       "fixed_usd": round(fixed), "team": rows, "other": other, "var_pu_m": var_pu_m,
       "contrib_at_2": {ch: round(contrib_per_user_year(2.0, ch), 2) for ch in ("direct", "partner")},
       "margin_at_2": {ch: round(contrib_per_user_year(2.0, ch) / 24 * 100, 1) for ch in ("direct", "partner")},
       "breakeven": be, "curve": curve, "quote4000": quote}
print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == "__main__" and "--extra" in sys.argv:
    lean = [("CTO", 1, 7000), ("Senior", 2, 5500), ("DevOps", 1, 5000), ("Dizayner", 1, 3500),
            ("Məzmun", 1, 3500), ("Satış", 1, 4000), ("Dəstək", 1, 2500)]
    lteam = sum(n * (g + employer_cost_azn(g)) * 12 / FX for _, n, g in lean)
    lother = 12000 + 8000 + 12000 + 35000 + 15000 + 40000 + 25000
    lfixed = (lteam + lother) * 1.1
    print("LEAN heads", sum(n for _, n, _ in lean), "team", round(lteam), "other", lother, "fixed", round(lfixed))
    for p in (1.5, 2.0, 2.5, 3.0):
        print(" BE", p, {ch: round(lfixed / contrib_per_user_year(p, ch)) for ch in ("direct", "partner")})
    for t, net in (("Essentials", 1.30), ("Professional", 1.95), ("Enterprise HRM", 2.60)):
        print("UNLIM", t, round(net * 12 * 5000))
    for r, idx in (("US", 1.0), ("EU", 1.0), ("GCC", 1.1), ("TR", 0.6), ("CIS", 0.55), ("CEE", 0.7)):
        l = 3.0 * idx; n = l * 0.65
        print("REG", r, round(l, 2), round(n, 2), round(n * 12 * 4000))
