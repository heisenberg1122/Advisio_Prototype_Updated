# Application typography

Advisio uses Inter with a 16px body size at the browser's default text setting.
The shared scale is defined in `apps/web/src/app/globals.css` using `rem` units
so it follows the user's browser text preferences.

| Role | Tailwind size | Default size |
| --- | --- | --- |
| Brief metadata, badges, timestamps | `text-xs` | 12px |
| Labels, navigation, secondary text, compact buttons and tables | `text-sm` | 14px |
| Body copy, descriptions, input/select/textarea text | `text-base` | 16px |
| Card and dialog headings | `text-lg` or `text-xl` | 18–20px |
| Page headings | `text-2xl` and responsive variants | 24–28px |

Use a body line height of 1.5 or greater. Keep form text at 16px on both mobile
and desktop. Small screens should reflow content rather than reduce its size.
Let button labels and dashboard values wrap when they need extra space.

Reserve 12–13px text for short companion information. Do not use sub-12px text
for application content. Icon glyph sizes, document annotation coordinates,
and the deliberately miniature walkthrough illustration have separate sizing
requirements and do not define the application's reading scale.
