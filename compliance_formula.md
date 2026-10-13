## 4. The compliance formula

### Step 1: Weights

| Dimension | Symbol | Weight (w) |
|---|---|---|
| A. Material type | M | 20 |
| B. Recyclability | R | 15 |
| C. Decomposition time | D | 10 |
| D. Embodied carbon | C | 20 |
| E. Lifespan / usage | L | 15 |
| F. Toxicity | T | 10 |
| G. Pollution shedding | P | 5 |
| H. Operating energy | E | 5 |
| **Total** | | **100** |

### Step 2: Harm Score (H)

For each item, take the weighted average of the ratings of the dimensions that apply to it:

```
H = ( Σ wᵢ × rᵢ ) / ( Σ wᵢ )        summed over applicable dimensions only
```

- `rᵢ` is the 1 to 5 rating for dimension *i*.
- If the item does not use energy, dimension H is skipped and the denominator becomes 95. The remaining weights are automatically re-balanced by the division.
- H ranges from **1.0 (best)** to **5.0 (worst)**.

### Step 3: Sustainability Index (SI)

Convert H to a 0 to 100 score where higher is better:

```
SI = 100 × (5 − H) / 4
```

| H | SI |
|---|---|
| 1.0 | 100 |
| 3.0 | 50 |
| 5.0 | 0 |

### Step 4: Compliance status

| SI range | Status | Stamp |
|---|---|---|
| 60 to 100 | **Compliant** | APPROVED |
| 40 to 59.9 | **Borderline** | PENDING REVIEW |
| 0 to 39.9 | **Non-Compliant** | DENIED |