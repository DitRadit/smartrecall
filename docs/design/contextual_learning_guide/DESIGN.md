---
name: Contextual Learning Guide
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#43474e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f87'
  primary: '#022448'
  on-primary: '#ffffff'
  primary-container: '#1e3a5f'
  on-primary-container: '#8aa4cf'
  inverse-primary: '#adc8f5'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#002a1a'
  on-tertiary: '#ffffff'
  tertiary-container: '#00422b'
  on-tertiary-container: '#10b981'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#adc8f5'
  on-primary-fixed: '#001c3b'
  on-primary-fixed-variant: '#2d486d'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 20px
  gutter: 16px
  touch-target-min: 48px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 40px
---

## Brand & Style
The design system focuses on educational equity, specifically tailored for low-bandwidth and offline environments. The brand personality is encouraging and low-pressure, serving as a supportive digital tutor for students in remote areas. 

The visual style is a blend of **Corporate Modernism** and **Minimalism**, optimized for performance on low-spec hardware. By avoiding heavy blurs, complex gradients, or intensive animations, the UI remains snappy and responsive. The interface prioritizes clarity and high contrast to ensure readability under various lighting conditions, common in rural educational settings.

## Colors
The palette is grounded in a deep Navy Blue to establish a sense of institutional trust and academic rigor. Warm Amber is used strategically for high-priority calls to action and critical offline status indicators, ensuring they stand out against the soft background.

- **Primary (Navy):** Used for headers, primary actions, and brand identification.
- **Accent (Amber):** Reserved for "Start Learning" buttons and "Currently Offline" warnings.
- **Success (Green):** Used exclusively for correct answers and completed module states.
- **Neutral (Grays):** Used for secondary information and structural borders to maintain a lightweight feel.
- **Background (Off-white):** A soft, cool gray-white that reduces eye strain during long study sessions.

## Typography
The design system utilizes **Be Vietnam Pro** for its contemporary, friendly tone and exceptional readability in the Vietnamese and Indonesian alphabets (supporting similar diacritics and character widths). 

Line heights are intentionally generous (1.5x - 1.6x) to assist students with lower literacy levels or those reading on smaller, lower-resolution screens. Headline sizes are capped for mobile to ensure content remains the focus without excessive scrolling.

## Layout & Spacing
The layout follows a **fluid grid** model optimized for mobile-first PWA usage. A 4-column grid is used for mobile devices, expanding to 8 columns for tablets. 

To accommodate diverse motor skills and environmental factors (like outdoor usage), a strict minimum touch-target size of 48px is enforced for all interactive elements. Vertical rhythm is maintained through a base-8 spacing scale, ensuring consistent stacking of micro-learning content blocks. 
- **Mobile:** 20px side margins, 16px gutters.
- **Tablet/Desktop:** Max-width container of 960px, centered, to prevent line lengths from becoming unreadable.

## Elevation & Depth
To maximize performance on older mobile chipsets, this design system eschews complex shadows. Depth is communicated primarily through **Tonal Layers** and **Low-contrast outlines**.

- **Level 0 (Background):** Soft Off-white (#F5F7FA).
- **Level 1 (Cards/Content):** Pure White (#FFFFFF) with a 1px solid border (#E2E8F0). No shadow.
- **Level 2 (Active/Floating):** Pure White with a very soft, high-spread 4px shadow at 5% opacity. Used only for "Offline" toasts or persistent navigation bars.

## Shapes
The shape language is purposefully **Rounded** to feel approachable and "human." Soft corners remove the clinical feel of traditional education software, making the micro-learning experience feel more like a conversational tool than a test. 

- **Cards and Containers:** Use `rounded-lg` (1rem/16px) for a soft, friendly framing of content.
- **Buttons:** Use `rounded-xl` (1.5rem/24px) or full pill-shape to emphasize their interactability.
- **Input Fields:** Follow the `rounded-md` (0.5rem/8px) standard for a balance of structure and softness.

## Components
### Buttons
Primary buttons use the Navy Blue background with white text. CTA buttons (like "Sync Now" or "Resume Lesson") use the Amber background with dark text for maximum visibility. All buttons must maintain a 48px minimum height.

### Cards
Cards are the primary container for micro-learning modules. They feature a white background, 1px light gray border, and 16px internal padding. In "Offline Mode," cards may feature a small Amber top-border to indicate they are cached locally.

### Progress Indicators
Progress is shown through simple, linear bars. The background track is a light gray, and the fill is Primary Navy. Avoid "shimmer" animations; use a solid fill to save CPU cycles.

### Offline Banners & Toasts
When the device loses connection, a persistent Amber banner appears at the top of the viewport. It uses a simple icon and concise text ("Working Offline"). Toasts for "Sync Complete" use the Success Green.

### Input Fields
Inputs use a 1px border that thickens and changes to Primary Navy when focused. Labels are always visible (not floating) to ensure the user never loses context of the required information.

### Lists
Lists use generous vertical padding (16px) between items with a light horizontal separator. Each list item should have a chevron or an icon to indicate clear tap areas.