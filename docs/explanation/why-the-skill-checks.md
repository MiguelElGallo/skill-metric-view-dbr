# Why the skill checks every definition

The skill checks each definition as part of creating or editing it. You do not need to learn or run another tool.

This makes the conversation shorter:

1. You describe the metric view you need.
2. The skill drafts or edits the definition.
3. It catches YAML and structural problems immediately.
4. For creation and semantic audits, it also points out missing descriptions, display names, format reviews, placeholders, and deterministic synonym problems.
5. It tells you what still requires business approval or Databricks.

Fast checks are useful for repeated keys, missing properties, invalid internal references between definition elements, and incompatible feature choices. Sending those mistakes to a workspace would add authentication, network, compute, and analyzer time without adding useful evidence.

Semantic-quality suggestions are informational: they do not change whether the YAML passes, and they cannot tell whether a comment is true or a synonym is approved. Databricks remains the authority for real tables, SQL expressions, permissions, and execution. Business owners and governed evidence remain the authority for meaning. The automatic check removes avoidable mistakes; it does not pretend to replace either authority.
