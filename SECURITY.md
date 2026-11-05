# Security policy

## Reporting a vulnerability

Write to **[security contact address — to be provided by the owner]**. Do not open a public issue or pull request for a vulnerability.

Include what you found, the steps or a proof of concept that reproduces it, the affected URL, endpoint or file, and the impact you expect. Test only against your own installation or the local demo (`npm --prefix portal run demo`), never against a customer's organisation, and do not access, change or keep other people's data.

## Supported versions

The product has not had its first release. Only the `main` branch is supported: fixes land there and are not backported.

| Version | Supported |
|---|---|
| `main` | yes |
| anything older | no |

## Response targets

| Step | Target |
|---|---|
| Acknowledge the report | 3 business days |
| First assessment and severity | 10 business days |
| Fix for a critical or high finding | 30 days |
| Fix for a medium or low finding | 90 days |

We tell you when the fix is merged and agree a disclosure date with you. If a target cannot be met, we say so and give a new date.
