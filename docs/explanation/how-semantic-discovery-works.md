# How semantic discovery works

A useful metric view begins with meaning, not YAML.

The skill keeps four kinds of evidence separate:

| Evidence | Example | Meaning |
| --- | --- | --- |
| **Business-authoritative** | Approved KPI formula, owned glossary, certified SQL | Safe to use within its stated scope unless another authority conflicts. |
| **Governed metadata** | Unity Catalog comment, tag, declared key, owned Genie instruction | Useful context whose owner, date, and currentness still matter. |
| **Observed** | Dashboard calculation, sampled values, successful join test | Shows how data is shaped or used, but not necessarily why. |
| **Inferred** | A column name that looks like a key or amount | A proposal that needs confirmation when it changes business meaning. |

Every item keeps its exact locator, known owner or authority, retrieval time, and conflict/currentness status. This prevents a plausible column name—or a stale technical comment—from becoming an official metric silently.

## Metadata comes before data

The skill first reads table and column metadata, comments, tags, and declared constraints. That is often enough to narrow the design.

Sampling is separate because it reads actual rows. When authorized, the skill bounds the sample fraction or bucket, estimated scan, returned rows, profiling-query count, timeout, and warehouse, and excludes sensitive columns from raw output. Samples can reveal categories, nulls, ranges, and possible fan-out. They cannot prove full-table uniqueness or define what a code means.

## Grain controls the design

Before proposing measures, the skill states what one source row appears to represent. An order table, order-line table, daily snapshot, and customer dimension produce different counts and sums even when their columns look similar.

The skill then:

1. prefers one direct fact source when it preserves the real grain;
2. justifies dimension joins;
3. proposes fields people actually group or filter by;
4. defines atomic measures with units, filters, and distinct keys;
5. composes ratios from those measures;
6. lists open questions before writing YAML.

When questions span multiple fact grains, the skill evaluates Databricks one-to-many branches, independent sibling branches, and bridge-source designs before suggesting a separate pre-aggregated base view.

The output keeps evidence attached to each choice. You can approve the business meaning first, then let the skill generate and check the definition.
