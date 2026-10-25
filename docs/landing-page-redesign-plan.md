# Advisio landing page redesign plan

Status: proposed design and implementation plan. No application changes or deployment are part of this planning pass.

## Direction: a blueprint for your research journey

Keep Advisio's established navy, gold, logo, and Inter typography. Move the landing page toward a light editorial composition: white paper, pale construction lines, generous spacing, large navy headlines, and small monospace labels. Make the product itself the main visual through a clearly labeled sample research workspace.

The page should answer three questions in order: what Advisio does, how a research project moves through it, and how a visitor starts. Motion should explain connection and progress. Avoid competing loops, invented metrics, testimonials, or unsupported integration claims.

### What exists today

- `/` renders `apps/web/src/app/(public)/home/page.tsx` through React Router in `apps/web/src/routes.tsx`.
- The current page contains a navy introduction, three journey steps, three feature cards, and an explanation of Google connections.
- `PublicLayout.tsx` also serves public policy pages. A landing-specific composition should avoid restyling those pages accidentally.
- This application runs React 19 and Vite. The `app/` folder names do not make this a Next.js runtime.
- A research-dashboard walkthrough exists in source but currently has no route in `routes.tsx`. Do not send visitors to an unregistered walkthrough URL.

## Page sequence and proposed content

### 1. Navigation

White header with the existing logo at the left, section links in the middle, and Sign in / Get started actions at the right. Links: How it works, About, FAQ. Get started and Sign in both lead to `/login`; the distinct Request an account action leads to `/register`.

Use the supplied underline treatment: a 2px pseudo-element, `scaleX(0)` with the right origin at rest, left origin on hover/focus, and a 500ms transition with `cubic-bezier(.32,.72,0,1)`. Add a full ink text color on hover. Use `aria-current="location"` for a currently viewed section; reserve `aria-current="page"` for actual route links.

At narrow widths use an accessible menu button with `aria-expanded` and `aria-controls`. Keep a primary sign-in action visible, close the menu after selection or Escape, and return focus to its trigger when appropriate. If the header is sticky, give all section targets sufficient scroll margin.

### 2. Blueprint hero

Eyebrow: **ACADEMIC RESEARCH, CONNECTED**

Headline: **From your first proposal to your final defense.**

Supporting copy: **Bring your team, adviser feedback, documents, and deadlines into one clear research workspace.**

Actions: **Get started** → `/login`; **See how it works** → `#how-it-works`. Keep Request an account → `/register` as a quieter supporting link. Retain a brief statement that workspace access follows institutional account and role permissions.

Composition: a wide white blueprint field with the headline on an opaque white surface and an adjacent sample workspace. On smaller screens, stack the preview beneath the copy. Include recognizable product details: a research milestone list, manuscript review, and consultation coordination. Label the illustration “Sample workspace”; use no real student information or fabricated adoption statistics.

Motion specification:

- Four full-size vertical 1px elements, three horizontal elements, and an inset frame, all absolutely positioned and decorative (`aria-hidden="true"`).
- Draw verticals with `scaleY(0 → 1)`, origin `50% 0`; horizontals with `scaleX(0 → 1)`, origin `0 50%`. Draw frame edges using the same transforms.
- Use 600–900ms durations, 100–120ms stagger, and the requested easing. Never animate line width or height.
- After the last line lands, scale in small intersection crosshairs and fade the headline block with a 12px upward settle. Target a complete introduction around 1.6–1.9 seconds and assess its effect on LCP during implementation.
- Observe the hero once with IntersectionObserver; disconnect after activation. Keep final, visible content as the default if enhancement fails. Reserve all content dimensions before animation.
- Reduced motion renders the completed grid and readable text immediately.

### 3. How it works: the research journey

Heading: **A clear path through every research milestone.**

Use four numbered steps beside a winding S-curve:

1. **Set up your research.** Organize a project, research team, and milestones.
2. **Connect with your adviser.** Coordinate guidance, consultations, and feedback.
3. **Submit, review, refine.** Keep manuscripts, submissions, and revisions organized.
4. **Prepare for defense.** Follow requirements, schedules, and panel reviews.

This describes the journey rather than imposing a new system workflow or promising automatic approval.

Motion specification:

- Inline SVG with a faint full track and a 6px accent path, no fill, and round line caps. Use a navy path on a pale blue track with gold milestone details.
- Read `getTotalLength()` once per path geometry. Initialize dasharray and dashoffset to the measured length.
- Preserve the requested progress relationship: `clamp((scrollY + innerHeight * .55 - documentTop) / renderedHeight, 0, 1)`. Obtain documentTop from the SVG's bounding rectangle plus scrollY; `offsetTop` alone is unreliable inside positioned ancestors.
- Passive scroll listener schedules at most one requestAnimationFrame. Cache measurements outside the scroll hot path; refresh layout measurements on resize, font/layout changes, and initial deep-link positioning.
- Place nodes at fractions such as `.08`, `.36`, `.64`, `.92`, derived from the same path. Position the tip with `getPointAtLength(progress * length)`. Nodes and labels remain understandable before they light up.
- Use an ordered HTML list for readable content; hide the decorative SVG from assistive technology.
- Use a simpler vertical path on phones without shrinking the copy or creating sideways scrolling.
- Keep JavaScript as the shared progress source for line, tip, and nodes. A CSS view-timeline enhancement is optional; it must not run alongside a JavaScript writer on the same dashoffset or desynchronize the markers.
- Reduced motion shows the complete line and every node active.

### 4. About: one connected workspace

Heading: **The work around your research, brought together.**

Copy explains that Advisio connects researchers, advisers, reviewers, and academic administrators in a shared research process.

Adapt the supplied integrations animation to six verified product areas surrounding the Advisio logo:

- Research teams
- Advising and feedback
- Documents and versions
- Consultations
- Milestones and deadlines
- Defense and evaluation

These are product capabilities, not six third-party integrations. Beneath the diagram, retain a concise, accurate explanation of Google sign-in, administrator-connected Google Drive storage, and Google Calendar scheduling when configured. Keep the privacy policy and terms links available.

Motion specification:

- Six stationary tiles; SVG behind them uses `viewBox="0 0 160 100"` and `preserveAspectRatio="none"` so percentage tile centers map to path coordinates.
- Six straight paths end at the central tile. Each has `pathLength="1"`, dasharray 1, and dashoffset animating 1 → 0 over about 700ms.
- Stagger each launch by 450ms; move a small dot toward the center over about 1.1 seconds using the common easing. Keep dot transforms in the same SVG coordinate system as the line endpoints; compensate for stretching if needed so dots remain round.
- Light a tile when its dot launches. On arrival, emit a short-lived ring scaling to 1.7 and fading. Allow overlapping rings without restarting and losing the previous arrival.
- Play the complete sequence once when visible, then retain the settled state. Do not run an endless background interval.
- Meaningful visible tile labels provide accessible names. Use real links only when a public destination exists; otherwise use ordinary descriptive content. Any linked tile lifts 2px on hover/focus.
- On mobile, use a compact central brand block above a two-column capability list and a simpler connection treatment. Preserve readable labels and visual order.
- Reduced motion shows every connection and lit tile without moving dots or rings.

### 5. FAQ

Heading: **A few things before you begin.**

Proposed questions:

- **Who is Advisio for?** University researchers, advisers, panelists, and academic administrators, with access determined by their assigned roles.
- **How do I get access?** Sign in with an existing account or request one; access follows the institution's account and role requirements.
- **What can I manage in my workspace?** Research projects, documents, feedback, consultations, milestones, and defense coordination, depending on role.
- **Do I need to connect Google?** Explain that sign-in and the separately configured Drive/Calendar connections serve different purposes. Do not imply that signing in grants Drive access.
- **Where can I get help?** Link to the existing support email, privacy policy, and terms.

Use one rounded white card with flat rows, 1px separators, monospace `01` indices, and semibold 13px questions as requested (expressed in rem). Keep answers at the application's 16px body scale with comfortable line spacing.

At most one answer is open; clicking it closes all answers. Use native buttons with `aria-expanded` and `aria-controls`, and associated answer regions with `aria-labelledby`. Animate grid-template-rows 0fr → 1fr over 520ms; the inner child has overflow hidden and min-height 0. Animate answer opacity and translateY(-4px → 0), delayed 90ms. Synchronize accessibility state and prevent keyboard focus inside collapsed answers. Preserve visible focus outlines. Reduced motion switches instantly.

### 6. Get started

Heading: **Your next research milestone starts here.**

Keep this section compact, with Get started → `/login` and a supporting Request an account → `/register` link.

The main CTA uses the supplied soft moving border: a relative, isolated pill, overflow hidden, a large centered conic-gradient square rotating over about 3 seconds, a solid inset cover at 2px, and the label above both. Keep the interior navy, the label white, and the border pale gold/gold. Use transform-only rotation, a gentle hover tint, and a visible focus outline; no glow. Size the square large enough to cover the button's diagonal at every supported width. Prefer this animation on the principal hero and closing CTAs rather than every link.

### 7. Marquee band and footer

Directly above the footer, link a single-row band to `/login`. Suggested copy: **Move your research forward ↗**. Use a soft gold gradient and navy text.

The track has two exactly matching sequences, each containing enough repeats to span the viewport. Give the second `aria-hidden="true"`; expose a concise accessible name on the link. Match sequence widths and place seam spacing inside each sequence so translateX(-50%) loops cleanly. Use `width: max-content`, a 20–40 second linear transform animation, and `will-change: transform`. Pause on hover and focus-visible.

Provide a separate, persistent **Pause animations** control outside the band link so touch and keyboard users can stop continuous movement. Apply it to both the marquee and decorative CTA border; preserve the choice during the visit. Reduced motion stops both and presents one static line. Keep the footer itself still, with the existing brand, support email, copyright, privacy policy, and terms of service.

## Shared design and behavior requirements

- Landing-scoped palette: primary ink/navy `#0B3A53`, warm gold `#C9A227`, pale blue `#DAE6EF`, white paper, and a restrained cool background. Gold is primarily decoration; choose a darker tone when used for small text and verify contrast.
- Keep the public landing's brand independent of a returning user's stored college theme. Scope tokens under a landing root; do not change global dashboard or policy styling.
- Reuse Inter and a system monospace stack. Large responsive headlines, 16px body text, 12–13px short labels, 44px minimum practical touch targets, and a bounded readable content width.
- Mobile reflows content rather than shrinking the entire desktop canvas. Check at 320, 375, 768, 1024, and 1440px plus 200% browser zoom.
- Support keyboard access, skip link, meaningful headings, contrast, focus visibility, and reduced-motion preference changes during a visit. Do not announce decorative animation frames.
- Use the current React runtime, native DOM/SVG APIs, and CSS. Add no animation library, scroll hijacking, parallax dependency, or new data requests to render the landing.
- Clean up observers, listeners, requestAnimationFrame work, and pending dot/ring timers when navigating away. Account for React StrictMode's effect lifecycle.

## Suggested implementation boundaries

1. Compose the landing in `apps/web/src/app/(public)/home/page.tsx` and add a scoped `landing.css` beside it.
2. Add focused components under `apps/web/src/components/landing/`: `LandingHeader`, `BlueprintHero`, `ResearchJourney`, `ConnectedWorkspace`, `LandingFaq`, `GradientBorderLink`, and `LandingFooter`.
3. Keep semantic content separate from decorative layers. Use component refs for SVG/element measurements and small cleanup-safe hooks for reveal, reduced motion, and scroll progress where genuinely shared.
4. Preserve `/login`, `/register`, `/privacy-policy`, `/terms-of-service`, support email, and the existing account/authorization behavior. Do not add a walkthrough link until its destination is actually registered and reviewed.

## Delivery sequence and acceptance

1. **Static composition:** finalize copy, hero preview, section layouts, navigation, CTA routes, footer, mobile layout, and typography in a local preview.
2. **Motion and interaction:** add hero reveal, scroll journey, About sequence, FAQ, CTA borders, marquee, and motion pause/reduced-motion behavior.
3. **Verification:** inspect desktop/mobile layout, keyboard/menu/FAQ behavior, deep links, zoom, reduced motion, route navigation and cleanup, headline paint timing, and seamless marquee behavior. Run the web type-check and production build; run relevant existing tests and required repository checks, adding behavioral tests only where useful.
4. **Release when implementation is requested:** report local verification separately from remote results. After each push, inspect GitHub Actions and Vercel for the exact pushed commit. Investigate regressions; report pending checks as pending and do not equate a successful push with successful CI or deployment.

Acceptance: all seven requested treatments have a coherent role, all CTA destinations work, labels remain readable on small screens, animation never gates access to essential content or actions, no reduced-motion loops remain, and public policy/authenticated pages retain their existing behavior.

## Planning pass verification

An accompanying concept was reviewed in the browser at desktop, 375px, and 320px viewport sizes. The narrowest concept root reported equal client and scroll widths. FAQ interaction confirmed that opening another question closes the first, and Space closes an open question. The mobile menu opens and closes after a section selection. The browser reported no concept warnings or errors during the initial review; JavaScript syntax, unique element IDs, embedded logo resolution, and fragment size were also checked.

The browser uses reduced motion, so full-motion choreography and scroll timing remain implementation checks. This concept is a design reference rather than production code. The application was not built, committed, pushed, or deployed during this planning pass; no CI or deployment result is claimed.
