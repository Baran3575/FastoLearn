/**
 * Simge kitaplığı — arayüzde emoji yerine çizgi (stroke) tabanlı SVG simgeler.
 * Hepsi `currentColor` kullanır, bu yüzden tema rengiyle uyum sağlar.
 */

import type { ReactNode, SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
}

function Glyph({ size = 22, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

function Solid({ size = 22, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  )
}

export type IconComponent = (props: IconProps) => ReactNode

/* --- gezinme ------------------------------------------------------------- */

export const IconHome: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </Glyph>
)

export const IconTarget: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Glyph>
)

export const IconBrain: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M9.5 4.5a3 3 0 0 0-3 3 2.6 2.6 0 0 0-1.4 4.6A2.8 2.8 0 0 0 6.5 17c.3 1.6 1.6 2.5 3 2.5V4.5Z" />
    <path d="M14.5 4.5a3 3 0 0 1 3 3 2.6 2.6 0 0 1 1.4 4.6A2.8 2.8 0 0 1 17.5 17c-.3 1.6-1.6 2.5-3 2.5V4.5Z" />
    <path d="M12 4.5v15" />
  </Glyph>
)

export const IconUser: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.8 20c.9-3.6 3.7-5.4 7.2-5.4s6.3 1.8 7.2 5.4" />
  </Glyph>
)

/* --- eylemler ----------------------------------------------------------- */

export const IconPlay: IconComponent = (p) => (
  <Solid {...p}>
    <path d="M8 5.6c0-.8.9-1.3 1.6-.9l8 5.4a1 1 0 0 1 0 1.7l-8 5.4c-.7.5-1.6 0-1.6-.8V5.6Z" />
  </Solid>
)

export const IconClock: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 8v4.4l3 1.8" />
  </Glyph>
)

export const IconRepeat: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M20 11a8 8 0 0 0-13.6-5.2L4 8" />
    <path d="M4 5v3.4h3.4" />
    <path d="M4 13a8 8 0 0 0 13.6 5.2L20 16" />
    <path d="M20 19v-3.4h-3.4" />
  </Glyph>
)

export const IconCheck: IconComponent = (p) => (
  <Glyph {...p} strokeWidth={2.4}>
    <path d="M4.8 12.4l4.6 4.6L19.2 7.2" />
  </Glyph>
)

export const IconClose: IconComponent = (p) => (
  <Glyph {...p} strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Glyph>
)

export const IconPlus: IconComponent = (p) => (
  <Glyph {...p} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Glyph>
)

export const IconMinus: IconComponent = (p) => (
  <Glyph {...p} strokeWidth={2.2}>
    <path d="M5 12h14" />
  </Glyph>
)

export const IconPencil: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M4 20h4l10-10a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6 4 20Z" />
    <path d="M13.6 7.4 16.6 10.4" />
  </Glyph>
)

export const IconTrash: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M5 7h14" />
    <path d="M8 7V5.4A1.4 1.4 0 0 1 9.4 4h5.2A1.4 1.4 0 0 1 16 5.4V7" />
    <path d="M6.5 7l.8 11.2A1.9 1.9 0 0 0 9.2 20h5.6a1.9 1.9 0 0 0 1.9-1.8L17.5 7" />
    <path d="M10.5 11v5M13.5 11v5" />
  </Glyph>
)

export const IconDownload: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 4v10" />
    <path d="M8.4 10.6 12 14.2l3.6-3.6" />
    <path d="M5 17.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5" />
  </Glyph>
)

export const IconUpload: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 14.5V4.5" />
    <path d="M8.4 8.1 12 4.5l3.6 3.6" />
    <path d="M5 17.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5" />
  </Glyph>
)

export const IconGear: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="2.9" />
    <path d="M19.2 14.2a7.6 7.6 0 0 0 0-4.4l1.5-1-.5-2.3-1.7.2a7.7 7.7 0 0 0-3.8-2.2L14.2 3h-2.4l-.5 1.5a7.7 7.7 0 0 0-3.8 2.2l-1.7-.2-.5 2.3 1.5 1a7.6 7.6 0 0 0 0 4.4l-1.5 1 .5 2.3 1.7-.2a7.7 7.7 0 0 0 3.8 2.2l.5 1.5h2.4l.5-1.5a7.7 7.7 0 0 0 3.8-2.2l1.7.2.5-2.3-1.5-1Z" />
  </Glyph>
)

export const IconChevronRight: IconComponent = (p) => (
  <Glyph {...p} strokeWidth={2.1}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Glyph>
)

export const IconChevronLeft: IconComponent = (p) => (
  <Glyph {...p} strokeWidth={2.1}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Glyph>
)

export const IconVolume: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M5 9.5h2.8L11 6.4v11.2L7.8 14.5H5a1 1 0 0 1-1-1V10.5a1 1 0 0 1 1-1Z" />
    <path d="M14.4 9.2a4 4 0 0 1 0 5.6" />
    <path d="M16.8 6.8a7.4 7.4 0 0 1 0 10.4" />
  </Glyph>
)

export const IconBulb: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M9 17h6" />
    <path d="M10 20h4" />
    <path d="M12 3.5a5.5 5.5 0 0 0-3.2 9.9V17h6.4v-3.6A5.5 5.5 0 0 0 12 3.5Z" />
  </Glyph>
)

export const IconEye: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M2.5 12S6.3 6 12 6s9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.6" />
  </Glyph>
)

export const IconInfo: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 11v5.4" />
    <circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none" />
  </Glyph>
)

export const IconFlame: IconComponent = (p) => (
  <Solid {...p}>
    <path d="M12.9 2.2c.4 2.6-1.1 4-2.4 5.4-1.4 1.5-2.7 3-2.7 5.5a6 6 0 0 0 12 0c0-2.6-1.3-4.3-2.9-6-.4 1-1 1.7-1.9 2.1.5-2.7-.5-5.4-2.1-7Z" />
  </Solid>
)

export const IconStar: IconComponent = (p) => (
  <Solid {...p}>
    <path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 3.6Z" />
  </Solid>
)

export const IconBolt: IconComponent = (p) => (
  <Solid {...p}>
    <path d="M13.4 2.5 5.6 13.2h5L10 21.5l8-11h-5.1l.5-8Z" />
  </Solid>
)

export const IconTrophy: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0V4Z" />
    <path d="M7.5 5.5H5.2A1.2 1.2 0 0 0 4 6.7c0 2 1.3 3.3 3.5 3.5" />
    <path d="M16.5 5.5h2.3A1.2 1.2 0 0 1 20 6.7c0 2-1.3 3.3-3.5 3.5" />
    <path d="M12 13v3.5" />
    <path d="M8.6 20h6.8a.9.9 0 0 0 .9-.9v-.4a2.2 2.2 0 0 0-2.2-2.2H9.9a2.2 2.2 0 0 0-2.2 2.2v.4c0 .5.4.9.9.9Z" />
  </Glyph>
)

export const IconLayers: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 3.5 3.8 8 12 12.5 20.2 8 12 3.5Z" />
    <path d="M3.8 12.4 12 16.9l8.2-4.5" />
    <path d="M3.8 16.4 12 20.9l8.2-4.5" />
  </Glyph>
)

export const IconBook: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M4.5 5.2A1.7 1.7 0 0 1 6.2 3.5H12v17H6.2a1.7 1.7 0 0 0-1.7 1.7V5.2Z" />
    <path d="M19.5 5.2a1.7 1.7 0 0 0-1.7-1.7H12v17h5.8a1.7 1.7 0 0 1 1.7 1.7V5.2Z" />
  </Glyph>
)

export const IconSparkles: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M11 4.5 12.4 8l3.5 1.4-3.5 1.4L11 14.3 9.6 10.8 6.1 9.4 9.6 8 11 4.5Z" />
    <path d="M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  </Glyph>
)

export const IconQuestion: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M9.4 9.2A2.7 2.7 0 1 1 12.6 12c-.7.4-1.1.9-1.1 1.9v.3" />
    <circle cx="11.6" cy="17.4" r="1" fill="currentColor" stroke="none" />
  </Glyph>
)

/* --- ünite simgeleri ---------------------------------------------------- */

export const IconWave: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M8.5 12.5V6.4a1.3 1.3 0 0 1 2.6 0v5.4" />
    <path d="M11.1 11.6V5.2a1.3 1.3 0 0 1 2.6 0v6.4" />
    <path d="M13.7 12V7.1a1.3 1.3 0 0 1 2.6 0v6.4" />
    <path d="M16.3 13.4v-2.2a1.3 1.3 0 0 1 2.6 0v3.9c0 3.1-2.4 5.4-5.4 5.4h-1.2a5.4 5.4 0 0 1-4.6-2.6L5.3 14a1.3 1.3 0 0 1 2.1-1.5l1.1 1.4" />
  </Glyph>
)

export const IconUsers: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19.5c.7-3 2.9-4.5 5.5-4.5s4.8 1.5 5.5 4.5" />
    <path d="M15.6 6.5a2.7 2.7 0 0 1 0 5.3" />
    <path d="M17.4 15.4c2 .4 3.3 1.8 3.8 4.1" />
  </Glyph>
)

export const IconHash: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M9.5 4 8 20" />
    <path d="M16 4l-1.5 16" />
    <path d="M4.5 9.5h15" />
    <path d="M4 14.5h15" />
  </Glyph>
)

export const IconPalette: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.9-.8 1.9-1.7 0-1-.8-1.5-.8-2.3 0-.8.6-1.4 1.5-1.4h1.6a4.3 4.3 0 0 0 4.3-4.3c0-4-3.9-7.3-8.5-7.3Z" />
    <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.8" cy="10" r="1.1" fill="currentColor" stroke="none" />
  </Glyph>
)

export const IconGlobe: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.3" />
    <path d="M3.9 9.5h16.2" />
    <path d="M3.9 14.5h16.2" />
    <path d="M12 3.7c2.2 2.3 3.3 5 3.3 8.3S14.2 18 12 20.3C9.8 18 8.7 15.3 8.7 12S9.8 6 12 3.7Z" />
  </Glyph>
)

export const IconSchool: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 4 2.8 8.4 12 12.8l9.2-4.4L12 4Z" />
    <path d="M6.4 10.4v4.4c0 1.6 2.5 3 5.6 3s5.6-1.4 5.6-3v-4.4" />
    <path d="M21.2 8.4v5.2" />
  </Glyph>
)

export const IconBackpack: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M7 9V7.6A5 5 0 0 1 12 3a5 5 0 0 1 5 4.6V9" />
    <rect x="4.6" y="9" width="14.8" height="11.4" rx="2.4" />
    <path d="M9.2 13.6h5.6" />
  </Glyph>
)

export const IconBall: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.3" />
    <path d="M12 7.2 15.4 9.7l-1.3 4H9.9l-1.3-4L12 7.2Z" />
    <path d="M12 3.7V7.2M5.3 9.9l3.3-.2M18.7 9.9l-3.3-.2M8.6 13.7l-1.7 3.2M15.4 13.7l1.7 3.2" />
  </Glyph>
)

export const IconBread: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M5 11.4c0-3.4 3.1-5.9 7-5.9s7 2.5 7 5.9c0 1.3-.9 2.2-2.2 2.2H7.2C5.9 13.6 5 12.7 5 11.4Z" />
    <path d="M7.2 13.6V20h9.6v-6.4" />
    <path d="M10.4 16.4v1.6M13.6 16.4v1.6" />
  </Glyph>
)

export const IconFork: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M7 3.5v6a2.2 2.2 0 0 0 4.4 0v-6" />
    <path d="M9.2 9.6V20.5" />
    <path d="M16.2 3.5c-1.3 1.3-2 2.6-2 4.6 0 1.4.7 2.3 2 2.3s2-.9 2-2.3c0-2-.7-3.3-2-4.6Z" />
    <path d="M16.2 10.4v10.1" />
  </Glyph>
)

export const IconHouse: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M4 10.7 12 4.4l8 6.3" />
    <path d="M6.2 9.6V20h11.6V9.6" />
    <path d="M10 20v-5.2h4V20" />
  </Glyph>
)

export const IconHeart: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 19.5S4.5 15.2 4.5 10.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5-7.5 9.3-7.5 9.3Z" />
  </Glyph>
)

export const IconShirt: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M9 4.2 12 6l3-1.8 4 2.3-1.5 3.3-1.7-.7V20H8.2V9.1l-1.7.7L5 6.5l4-2.3Z" />
  </Glyph>
)

export const IconPaw: IconComponent = (p) => (
  <Glyph {...p}>
    <ellipse cx="7.6" cy="9.6" rx="1.7" ry="2.1" />
    <ellipse cx="12" cy="8.4" rx="1.7" ry="2.2" />
    <ellipse cx="16.4" cy="9.6" rx="1.7" ry="2.1" />
    <path d="M12 12.6c-2.6 0-4.8 2.1-4.8 4.2 0 1.4 1.1 2.2 2.4 2.2.9 0 1.6-.4 2.4-.4s1.5.4 2.4.4c1.3 0 2.4-.8 2.4-2.2 0-2.1-2.2-4.2-4.8-4.2Z" />
  </Glyph>
)

export const IconSun: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="3.7" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Glyph>
)

export const IconCalendar: IconComponent = (p) => (
  <Glyph {...p}>
    <rect x="4" y="5.6" width="16" height="14.4" rx="2.2" />
    <path d="M4 10h16" />
    <path d="M8.4 3.6v3.4M15.6 3.6v3.4" />
  </Glyph>
)

export const IconSunrise: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 4v2.2M6.2 8.4 4.8 7M17.8 8.4 19.2 7" />
    <path d="M8 15a4 4 0 0 1 8 0" />
    <path d="M3.6 15h16.8" />
    <path d="M6 19h12" />
  </Glyph>
)

export const IconChef: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M7.4 12.6a3.7 3.7 0 1 1 1.6-7 3.6 3.6 0 0 1 6 0 3.7 3.7 0 1 1 1.6 7v2.8H7.4v-2.8Z" />
    <path d="M7.4 18.4h9.2" />
    <path d="M7.4 15.4v6" />
    <path d="M16.6 15.4v6" />
  </Glyph>
)

export const IconCity: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M3.6 20V9.6l5-2.8v13.2" />
    <path d="M8.6 20V5.6l6.4 3v11.4" />
    <path d="M15 20V10.4l5.4 2.6V20" />
    <path d="M3.6 20h16.8" />
    <path d="M6 13h1.2M6 16.4h1.2M11.4 12h1.2M11.4 15.4h1.2" />
  </Glyph>
)

export const IconPin: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M12 20.5s6-5.4 6-10.1A6 6 0 0 0 6 10.4c0 4.7 6 10.1 6 10.1Z" />
    <circle cx="12" cy="10.2" r="2.3" />
  </Glyph>
)

export const IconChat: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M20.2 12.4c0 3.9-3.6 7-8.1 7-.8 0-1.6-.1-2.3-.3l-4.4 2 1.3-3.6A6.6 6.6 0 0 1 3.9 12.4c0-3.9 3.7-7 8.2-7s8.1 3.1 8.1 7Z" />
    <path d="M8.8 12h.01M12 12h.01M15.2 12h.01" strokeWidth={2.4} />
  </Glyph>
)

export const IconKey: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="8.4" cy="12" r="3.4" />
    <path d="M11.8 12H20" />
    <path d="M17 12v3M14.4 12v2.2" />
  </Glyph>
)

export const IconFlag: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M6 21V4.2" />
    <path d="M6 5h10.6l-1.6 3.4 1.6 3.4H6" />
  </Glyph>
)

export const IconAward: IconComponent = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="9.4" r="5.4" />
    <path d="M8.6 14 7.4 21l4.6-2.4L16.6 21l-1.2-7" />
  </Glyph>
)

export const IconChart: IconComponent = (p) => (
  <Glyph {...p}>
    <path d="M4.5 19.5h15" />
    <path d="M7.5 19.5v-6M12 19.5V6.5M16.5 19.5v-9" />
  </Glyph>
)

/* --- bölüm → simge eşlemesi (20 bölüm) --------------------------------- */

export const SECTION_ICONS: Record<string, IconComponent> = {
  // Ünite 1 — İlk Adımlar
  begruessung: IconWave,
  bekanntschaft: IconUser,
  zahlen: IconHash,
  farben: IconShirt,
  familie: IconUsers,
  laender: IconGlobe,
  schule: IconSchool,
  klassenzimmer: IconBackpack,
  freizeit: IconBall,
  essen: IconBread,
  // Ünite 2 — Günlük Hayat
  wohnen: IconHouse,
  koerper: IconHeart,
  tiere: IconPaw,
  wetter: IconSun,
  zeit: IconCalendar,
  verben: IconRepeat,
  adjektive: IconSparkles,
  fragewoerter: IconQuestion,
  stadt: IconCity,
  berufe: IconChef,
}

export function unitIcon(id: string): IconComponent {
  return SECTION_ICONS[id] ?? IconBook
}

/** Kelime türüne göre küçük simge. */
export function posIcon(pos: string): IconComponent {
  switch (pos) {
    case 'noun':
      return IconLayers
    case 'verb':
      return IconRepeat
    case 'adj':
    case 'adv':
      return IconSparkles
    case 'phrase':
      return IconChat
    case 'pron':
      return IconUser
    case 'num':
      return IconHash
    case 'prep':
      return IconPin
    default:
      return IconBook
  }
}
