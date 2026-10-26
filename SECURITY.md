# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | yes |
| 0.1.x | no — upgrade to 1.x |

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository. Include the package version, the
node's typeVersion, and the steps to reproduce.

You will get an acknowledgement as soon as the report is read, and a fix or an assessment as
quickly as the issue allows.

## What the node does with your data

- Phone, text case and country transformations run entirely inside your n8n instance.
- The postal-address transformation sends the geographical part of an address — number,
  street, postcode, municipality — to the public geocoding service of the Géoplateforme
  (`data.geopf.fr`), over HTTPS, through n8n's own HTTP helper. Nothing else from the item is
  sent, and nothing is kept between executions.
- Diagnostics and the `_format` trace never contain the processed values, unless you turn on
  the **Trace Values** option.
