# Why check locally first

Databricks is the final authority for a metric view, but it is not the best place to discover a missing colon or a misspelled field.

A Databricks submission includes network time, warehouse state, authentication, statement analysis, and result polling. A local parser can reject many mistakes in a fraction of that path. This shortens the feedback loop while the definition is still being written.

Local-first does not mean local-only. Some questions have no honest offline answer: whether a source column exists, whether the current identity can read it, whether a SQL expression resolves to the expected type, and whether a declared join cardinality is true in the data.

The checker therefore stops at a clear boundary. It handles quick, deterministic checks and says what remains. Databricks handles workspace and analyzer truth.
