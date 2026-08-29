# Why the skill checks every definition

The skill checks each definition as part of creating or editing it. You do not need to learn or run another tool.

This makes the conversation shorter:

1. You describe the metric view you need.
2. The skill drafts or edits the definition.
3. It catches YAML and structural problems immediately.
4. It tells you what still requires Databricks.

Fast checks are useful for repeated keys, missing properties, invalid internal references between definition elements, and incompatible feature choices. Sending those mistakes to a workspace would add authentication, network, compute, and analyzer time without adding useful evidence.

Databricks remains the authority for real tables, SQL expressions, permissions, and execution. The automatic check removes avoidable mistakes; it does not pretend to replace the platform.
