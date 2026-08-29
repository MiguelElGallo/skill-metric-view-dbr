# Review an existing metric view

Attach the YAML file by dragging it into Chat or selecting **Add Context**. Then tell the skill whether it may edit the file.

## Review without changing the file

~~~text
Use the databricks-metric-view skill to review the attached metric-view definition.

Target: <SQL warehouse or Databricks Runtime version>
Group the findings into:
1. definition errors,
2. compute or feature compatibility,
3. questions that need Databricks or business knowledge.

Do not edit the file, connect to Databricks, or deploy.
~~~

This is useful for code review because the original file stays unchanged.

## Review the business semantics

Use this when the file is structurally valid but might not represent the business correctly:

~~~text
Review the attached metric view as a semantic model.
Check its stated source grain, measure units and filters, distinct-count keys,
join assumptions, descriptions, synonyms, and coverage of these questions:
- <business question>

Label each conclusion business-authoritative, governed metadata, observed, or inferred. Include the exact locator, known owner, retrieval time, and currentness or conflict status.
List the evidence you would need to resolve uncertain business meaning.
Do not edit, connect, or deploy.
~~~

## Fix confirmed problems

~~~text
Fix the confirmed definition errors in the attached metric view.
Preserve unrelated content, ordering, scalar style, and comments.
Check the complete file after the edit.
Do not connect to Databricks or deploy.
~~~

The skill should describe each change and keep uncertain business decisions separate.

## Add live context without deploying

When table and column existence matters, authorize a bounded read-only check:

~~~text
Review the attached metric view with Databricks profile <PROFILE>.
Confirm the source objects and referenced columns using read-only metadata.
Do not create, update, replace, or drop anything.
Report local findings separately from live findings.
~~~

Do not paste access tokens into the prompt. Use an authenticated Databricks profile.

If you want Databricks to accept and query the finished definition, use [Deploy and verify a metric view](deploy-a-view.md).
