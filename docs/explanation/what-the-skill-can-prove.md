# What the skill can prove

The answer depends on what you asked the skill to do.

| Result | What it proves | What it does not prove |
| --- | --- | --- |
| Checked draft | The YAML parses and follows the supported definition rules for the supplied compute context. | Real objects, permissions, data, SQL resolution, or Databricks acceptance. |
| Semantic-quality suggestions reviewed | Durable descriptions and display names are present where expected, applicable formats were considered, and deterministic synonym issues were surfaced. | Correct, approved, complete, or current business meaning. |
| Semantic inventory | The proposed elements are traceable to business-approved authority, governed metadata, observations, or inference. | That metadata is current, inferred meaning is correct, or samples represent all data. |
| Live metadata review | The selected profile can see the inspected objects, columns, comments, constraints, and compute context. | Full analyzer acceptance or business correctness. |
| Bounded sample review | The returned sample has the reported values, nulls, and relationship shape. | Full-table uniqueness, cardinality, or business meaning. |
| Temporary analyzer canary passed | The workspace parsed the definition and resolved its sources in that temporary session. | Permission, ownership, grants, or acceptance on the final target. |
| Databricks accepted the target | The workspace accepted the create or update on the fully qualified target in that permission context. | Correct results for every business case. |
| Smoke query passed | The created view can return the tested fields and measures. | Untested measures, edge cases, or truthful join-cardinality assumptions. |
| Trusted SQL reconciled | Comparable queries matched for the stated snapshot, timezone, parameters, filters, groups, null rules, and tolerances. | Untested cases or future source changes. |

The skill reports these results separately so a fast draft is never mistaken for a semantically ready, deployed, and tested view. Semantic readiness additionally requires question coverage, a complete source-column include/exclude/defer ledger, measure contracts, relationship status, approved metadata, and visible gaps.

For a checked draft, ask:

~~~text
Do not deploy. Tell me what you checked and what still needs Databricks.
~~~

For the strongest available result, give explicit deployment scope and ask:

~~~text
After creation, read back the definition, test every important measure,
and reconcile it with the attached trusted SQL across representative fields and filters.
Separate platform acceptance, smoke-query success, and business reconciliation.
~~~
