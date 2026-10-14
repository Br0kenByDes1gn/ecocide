# Household Sustainability Scoring Framework

Defines how every detected household item is rated, how the ratings combine into one score, and how that score decides whether the item is **Compliant**, **Borderline** or **Non-Compliant**.

> **Important:** All ratings and weights below are **proposed relative values**, not measured data. Before showing them to users, calibrate them against published sources (e.g. EPA WARM, ecoinvent or similar life-cycle databases, national recycling guidance) and label every output as an *estimate*.

---

## 1. Rating scale

Every dimension uses the same scale so they can be combined.

| Rating | Meaning |
|---|---|
| 1 | Very low harm (best) |
| 2 | Low harm |
| 3 | Moderate harm |
| 4 | High harm |
| 5 | Very high harm (worst) |

---

## 2. Scoring dimensions (core)

These eight dimensions feed the formula.

### A. Material type

| Subcategory | Variants | Rating |
|---|---|---|
| Plastic | PET #1 (bottles) | 3 |
| | HDPE #2 (containers, jugs) | 3 |
| | PVC #3 (pipes, toys, cling film) | 5 |
| | LDPE #4 (bags, wrap) | 4 |
| | PP #5 (tubs, caps) | 3 |
| | Polystyrene / Styrofoam #6 | 5 |
| | Mixed or "other" #7 | 5 |
| | Bioplastic (PLA) | 3 |
| Disposable tableware | Plastic cutlery, plates, cups, straws | 5 |
| | Paper or compostable versions | 2 |
| Metal | Aluminium | 2 |
| | Steel / stainless | 2 |
| | Copper / brass | 2 |
| | Mixed alloy or coated | 3 |
| Glass | Bottles, jars, panes | 2 |
| Paper | Plain paper, cardboard | 1 |
| | Laminated or waxed paper, tetra packs | 3 |
| Wood | Solid wood | 1 |
| | Engineered (MDF, plywood, particleboard) | 3 |
| | Treated or painted wood | 3 |
| Textiles | Linen, hemp | 2 |
| | Cotton, wool | 3 |
| | Polyester, nylon, acrylic | 4 |
| | Blends | 4 |
| | Leather and faux leather | 4 |
| Rubber and foam | Natural rubber | 3 |
| | Synthetic rubber, polyurethane foam | 4 |
| Ceramic and stone | Ceramics, porcelain, stone | 2 |
| Paint, chemicals, solvents | Paint, varnish, cleaning chemicals, aerosols | 5 |
| Electronics | E-waste, small appliances, cables | 5 |
| Batteries | Disposable, lithium | 5 |
| Organic | Food, plants | 2 |

### B. Recyclability

| Subcategory | Meaning | Rating |
|---|---|---|
| Reusable or durable | Can be used again as is | 1 |
| Home or industrial compostable | Returns to soil | 1 |
| Widely recyclable | Accepted in most local collection | 2 |
| Recyclable with effort | Needs drop-off or special collection | 3 |
| Downcycled only | Quality degrades, limited uses | 4 |
| Not recyclable | Landfill or incineration | 5 |
| Hazardous / special handling | E-waste, batteries, paint, bulbs | 5 (plus disposal warning) |

*Region-aware:* the user's country/city can shift this rating by ±1 (see Section 5).

### C. Decomposition time

Buckets of commonly cited ranges (real figures vary with conditions).

| Bucket | Typical items | Rating |
|---|---|---|
| Under 1 month | Food scraps, tissue | 1 |
| 1 to 12 months | Paper, cardboard, cotton scraps | 2 |
| 1 to 10 years | Wool, untreated wood, some textiles | 3 |
| 10 to 100 years | Treated wood, leather, rubber | 4 |
| 100 to 500 years | Most plastics, aluminium cans, synthetic fabrics | 5 |
| Effectively permanent | Glass, Styrofoam, some composites | 5 |

### D. Embodied carbon (manufacturing and shipping footprint)

Rated relative to the item's size and type.

| Subcategory | Examples | Rating |
|---|---|---|
| Very low | Paper goods, small wooden items | 1 |
| Low | Glass jars, cotton basics | 2 |
| Medium | Furniture, ceramics, small plastic goods | 3 |
| High | Fast-fashion clothing, mattresses, aluminium goods | 4 |
| Very high | Electronics, large appliances | 5 |

### E. Lifespan and usage pattern

| Subcategory | Examples | Rating |
|---|---|---|
| Single-use | Cutlery, wrappers, wipes, sachets | 5 |
| Short-life (under 1 year) | Fast fashion, cheap gadgets | 4 |
| Medium life (1 to 5 years) | Phones, shoes, small appliances | 3 |
| Long life (5 to 15 years) | Furniture, larger appliances | 2 |
| Heirloom / lifetime | Cast iron, solid furniture, quality tools | 1 |

### F. Toxicity and hazard

| Subcategory | Examples | Rating |
|---|---|---|
| Inert | Glass, steel, ceramic, wood | 1 |
| Low concern | Most paper and cotton | 2 |
| Moderate | Treated textiles, adhesives, some plastics | 3 |
| High | PVC, flame retardants, heavily dyed or printed items | 4 |
| Hazardous | Batteries, paint, solvents, CFL bulbs, e-waste, aerosols | 5 |

### G. Pollution shedding (microplastics and leaching)

| Subcategory | Examples | Rating |
|---|---|---|
| None | Glass, metal, ceramic | 1 |
| Low | Natural fibres | 2 |
| Moderate | Plastic containers, non-stick coatings | 3 |
| High | Synthetic clothes and fleece, scrubbing sponges, glitter, microbead products | 5 |

### H. Operating energy (appliances and electronics only)

Applies only when the item uses power. A photo cannot show efficiency, so ask the user for the age or star rating, or fall back to category averages.

| Subcategory | Examples | Rating |
|---|---|---|
| Passive, no energy use | (not applicable: dimension skipped) | n/a |
| Low | LED lights, chargers | 2 |
| Medium | TV, fridge, router, fan | 3 |
| High | AC, geyser, washing machine, oven | 4 |
| Always-on and inefficient | Old fridge, standby clutter | 5 |

---

## 3. Informational tags (not in the core formula)

These are displayed and used for recommendations. They do not change the score unless you choose to add them later.

### I. Water footprint

| Subcategory | Examples | Rating |
|---|---|---|
| Low | Glass, metal, wood | 1 to 2 |
| Medium | Paper, plastics, wool | 3 |
| High | Cotton clothing, leather, jeans | 4 to 5 |

### J. Packaging burden (consumables)

| Subcategory | Examples | Rating |
|---|---|---|
| Unpackaged / refillable | Loose goods, refill stations | 1 |
| Minimal, recyclable | Paper or glass packaging | 2 |
| Mixed packaging | Boxed items with plastic windows | 3 |
| Multi-layer | Sachets, snack wrappers, tetra packs | 5 |

### K. End-of-life action (drives swaps and pledges)

| Subcategory | Suggested action |
|---|---|
| Repairable | Repair instead of replace |
| Donatable or resellable | Donate, sell, swap |
| Upcyclable | Reuse creatively |
| Take-back available | Return to maker or retailer |
| Needs special disposal | E-waste or hazardous collection point |
| Landfill only | Avoid buying again |

---

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

### Step 5: Override rules

Some items fail regardless of the average, because a single severe property should not be hidden by good scores elsewhere. Apply these after Step 4.

| # | Rule | Effect |
|---|---|---|
| 1 | **Single-use plastic:** L = 5 and material is Plastic or Disposable tableware (plastic) | Status forced to **Non-Compliant** |
| 2 | **Hazardous:** T = 5 | Cannot be Compliant. Status becomes **Special Handling Required** until a proper-disposal pledge is made |
| 3 | **Landfill trap:** R = 5 and D ≥ 4 and L ≥ 4 | Status forced to **Non-Compliant** |

When an override fires, the dossier should say which rule triggered it (this feeds the "Explain this verdict" panel).

---

## 5. Adjustment modifiers

Applied to ratings *before* Step 2.

| Modifier | Rule |
|---|---|
| **Region recyclability** | If local collection accepts the material, R − 1. If local collection does not accept it, R + 1. Clamp R to 1 to 5. |
| **User-confirmed energy** | If the user supplies the age or star rating, use it for H. Otherwise use the category average. |
| **Condition / age** | If the user confirms the item is still in use and repairable, L − 1 (clamp to 1). |
| **Low confidence detection** | If Gemini's detection confidence is below 0.6, mark the item "needs confirmation" and exclude it from the total until the user confirms or corrects it. |

---

## 6. Household roll-up

Items differ in size and quantity, so the household score is a weighted average.

```
Item weight   = quantity × size factor
Size factor   = 0.5 (small) | 1 (medium) | 2 (large)

Household SI  = Σ ( SIᵢ × item weightᵢ ) / Σ ( item weightᵢ )
```

The **Compliance Ratio** shown to the user is the Household SI as a percentage.

Also report:

| Metric | Formula |
|---|---|
| Items compliant | count of Compliant items ÷ total items |
| Hard-fail count | number of items hit by an override rule |
| Dominant dimension | the dimension with the highest weighted average rating (drives the title) |

### Classification titles (driven by the dominant dimension)

| Dominant driver | Title |
|---|---|
| Plastic material / shedding | Petroleum Hoarder |
| Textiles | Fast-Fashion Collector |
| Electronics / batteries | Gadget Graveyard Keeper |
| Single-use lifespan | Disposable Enthusiast |
| Operating energy | Watt Wizard |
| Household SI ≥ 60 | Model Citizen (grudgingly) |

---

## 7. Appeal (pledge) adjustment

A pledge improves the score only in proportion to its quality.

```
Pledge Credit = Specificity × Feasibility × Impact × Max Uplift
```

- **Specificity, Feasibility, Impact** each score 0 to 1 from the Tribunal rubric.
- **Max Uplift** = 15 SI points per item (design choice, tune in testing).
- The updated item score is `SI_new = min(100, SI_old + Pledge Credit)`.
- Example: "I'll try to do better" scores near 0 on specificity, so it earns almost nothing. "I'll replace my 6 bottles a week with a steel bottle" scores high on all three.
- Overrides still apply unless the pledge removes the cause (e.g. replacing the single-use plastic item).

---

## 8. Worked examples

All ratings are illustrative.

### Example 1: Single-use PET water bottle

| Dim | Rating | w × r |
|---|---|---|
| M (PET) | 3 | 60 |
| R (widely recyclable) | 2 | 30 |
| D (100 to 500 yrs) | 5 | 50 |
| C (small plastic good) | 3 | 60 |
| L (single-use) | 5 | 75 |
| T (moderate) | 3 | 30 |
| P (moderate) | 3 | 15 |
| E | n/a | skipped |

- Σ w×r = 320, Σ w = 95, so **H = 3.37**
- **SI = 100 × (5 − 3.37) / 4 = 40.8** (Borderline by score)
- Override 1 fires (single-use plastic), so the final status is **Non-Compliant**.

### Example 2: Stainless steel water bottle

| Dim | Rating | w × r |
|---|---|---|
| M (steel) | 2 | 40 |
| R (reusable) | 1 | 15 |
| D (assumed 100+ yrs bucket) | 4 | 40 |
| C (medium) | 3 | 60 |
| L (long life) | 2 | 30 |
| T (inert) | 1 | 10 |
| P (none) | 1 | 5 |

- Σ w×r = 200, Σ w = 95, so **H = 2.11**
- **SI = 72.4**, no overrides, status **Compliant**.

### Example 3: 15-year-old refrigerator

| Dim | Rating | w × r |
|---|---|---|
| M (mixed alloy) | 3 | 60 |
| R (recyclable with effort) | 3 | 45 |
| D | 5 | 50 |
| C (large appliance) | 5 | 100 |
| L (long life) | 2 | 30 |
| T (moderate, refrigerant) | 3 | 30 |
| P (none) | 1 | 5 |
| E (always-on, inefficient) | 5 | 25 |

- Σ w×r = 345, Σ w = 100, so **H = 3.45**
- **SI = 38.8**, status **Non-Compliant**.
- Suggested action: energy-efficient replacement with proper take-back disposal, not a drop at the kerb.

---

## 9. Suggested data record (one row per item type)

| Field | Example |
|---|---|
| item_id | `pet_bottle_500ml` |
| display_name | Plastic water bottle |
| room_tags | kitchen, study |
| material | plastic_pet_1 |
| rating_M, R, D, C, L, T, P, E | 3, 2, 5, 3, 5, 3, 3, null |
| size_factor | 0.5 |
| tags | water=3, packaging=2 |
| end_of_life_action | recycle, replace with reusable |
| source | citation for each rating |

The Scanner (Gemini vision) identifies the item and likely material. The Auditor looks up the row and applies the formula. The Narrator only writes the story from the computed result. This keeps scores consistent and traceable instead of letting the model invent numbers each time.

---

## 10. Limitations to state openly

- Ratings are relative estimates and should be calibrated before launch.
- A photo cannot reveal item age, condition, efficiency or certification, so some inputs come from the user or from category averages.
- Local recycling rules vary, so region settings matter.
- The score evaluates **objects and habits only**, never people.
