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

## Complete metadata comes before data

The skill first reads the complete table and column metadata, comments, tags, and declared constraints for every bounded source. It reviews every source column and records `include`, `exclude`, or `defer` with a reason. This prevents a short prompt from silently becoming a short and semantically incomplete view.

Sampling is separate because it reads actual rows. When authorized, the skill bounds the sample fraction or bucket, estimated scan, returned rows, profiling-query count, timeout, and warehouse, and excludes sensitive columns from raw output. Samples can reveal categories, nulls, ranges, and possible fan-out. They cannot prove full-table uniqueness or define what a code means.

## Grain controls the design

Before proposing measures, the skill states what one source row appears to represent. An order table, order-line table, daily snapshot, and customer dimension produce different counts and sums even when their columns look similar.

The skill then:

1. prefers one direct fact source when it preserves the real grain;
2. justifies dimension joins;
3. maps every agreed question to fields, measures, and filters;
4. proposes fields people actually group or filter by;
5. defines atomic measures with formulas, units, filters, distinct keys, additivity, and null behavior;
6. composes ratios only after numerator, denominator, and zero behavior are known;
7. lists exclusions and open questions before writing YAML.

When questions span multiple fact grains, the skill evaluates Databricks one-to-many branches, independent sibling branches, and bridge-source designs before suggesting a separate pre-aggregated base view.

## Enrichment is part of the model

Databricks stores durable descriptions in `comment`. It also supports `display_name`, `format`, and `synonyms` for dashboards and AI tools such as Genie. The skill treats these as required production work even though Databricks makes them optional in YAML.

It reads existing business and governed language first. It reuses metadata only when the owner, currentness, scope, and conflict status make it applicable to the same semantic element. It does not copy a source comment unchanged onto a transformed field, filtered measure, ratio, or new object without checking the meaning.

When terminology is missing, the skill drafts a proposal with its target YAML path, evidence class, source locator, owner/currentness, and approval status. The proposal stays outside deployable YAML until approved. Mechanical title casing can be safe; currency, units, formula, filters, code labels, relationships, and synonyms are semantic assertions.

The output keeps evidence attached to each choice. You can approve the business meaning first, then let the skill generate and check the smallest semantically complete definition.
