import { type SVGProps } from 'react'

/**
 * The console's icon set, inlined.
 *
 * Twenty-odd line icons drawn on a 20×20 grid at 1.6px stroke, matching the Figma icon
 * page. Inlined rather than pulled from a package: an icon font or a 300-icon library
 * would ship far more than the console draws, and every icon here is one the design uses.
 */
export type IconName =
  | 'home'
  | 'car'
  | 'users'
  | 'shield'
  | 'briefcase'
  | 'file'
  | 'check'
  | 'settings'
  | 'bell'
  | 'search'
  | 'more'
  | 'refresh'
  | 'trash'
  | 'clock'
  | 'warning'
  | 'close'
  | 'plus'
  | 'download'
  | 'key'
  | 'lock'
  | 'chevron-down'
  | 'chevron-right'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'copy'
  | 'logout'
  | 'sun'
  | 'moon'
  | 'receipt'
  | 'info'
  | 'shield-check'
  | 'calendar'
  | 'pin'
  | 'check-circle'

const PATHS: Record<IconName, string> = {
  home: 'M3 9.5 10 3.5l7 6V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V9.5Z',
  car: 'M3.5 12.5v2.5h2v-1.5h9v1.5h2v-2.5l-1.6-4.2A1.5 1.5 0 0 0 13.5 7.5h-7A1.5 1.5 0 0 0 5.1 8.3L3.5 12.5Zm0 0h13M6.5 12.5h.01M13.5 12.5h.01',
  users: 'M13 16.5v-1.2a2.8 2.8 0 0 0-2.8-2.8H5.3a2.8 2.8 0 0 0-2.8 2.8v1.2M7.75 10a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Zm9.75 6.5v-1.2a2.8 2.8 0 0 0-2.1-2.7M12.7 4.6a2.75 2.75 0 0 1 0 5.3',
  shield: 'M10 2.5 4 4.8v4.4c0 3.7 2.6 6.4 6 8.3 3.4-1.9 6-4.6 6-8.3V4.8l-6-2.3Z',
  'shield-check': 'M10 2.5 4 4.8v4.4c0 3.7 2.6 6.4 6 8.3 3.4-1.9 6-4.6 6-8.3V4.8l-6-2.3Zm-2.5 7.7 1.8 1.8 3.4-3.6',
  briefcase: 'M3 7.5h14v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8Zm4 0V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 11h14',
  file: 'M6 2.5h5.5L15 6v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Zm5.5 0V6H15M7.5 9.5h5M7.5 12.5h5',
  receipt: 'M5 2.5h10v15l-2-1.5-2 1.5-1-1-1 1-2-1.5-2 1.5v-15Zm2.5 4h5M7.5 9.5h5M7.5 12.5h3',
  check: 'm4 10.5 3.8 3.8L16 6.5',
  'check-circle': 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm-3-7.5 2 2 4-4.5',
  settings: 'M10 12.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Zm6-2.75a6 6 0 0 0-.1-1l1.6-1.2-1.6-2.8-1.9.7a6 6 0 0 0-1.7-1L12 2.5H8l-.3 2.2a6 6 0 0 0-1.7 1l-1.9-.7-1.6 2.8L4.1 9a6 6 0 0 0 0 2l-1.6 1.2 1.6 2.8 1.9-.7a6 6 0 0 0 1.7 1l.3 2.2h4l.3-2.2a6 6 0 0 0 1.7-1l1.9.7 1.6-2.8L15.9 11a6 6 0 0 0 .1-1Z',
  bell: 'M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13L5 13.5ZM8.5 17a1.5 1.5 0 0 0 3 0',
  search: 'M9 14.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm8 2.5-4.1-4.1',
  more: 'M10 5.25h.01M10 10h.01M10 14.75h.01',
  refresh: 'M16 8.5A6.5 6.5 0 0 0 4.8 6.1L3.5 7.5m0 0V4m0 3.5H7M4 11.5a6.5 6.5 0 0 0 11.2 2.4l1.3-1.4m0 0V16m0-3.5H13',
  trash: 'M4 5.5h12M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5 6.2 16a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10.5M8.5 9v5M11.5 9v5',
  clock: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm0-11.5v4l2.5 1.5',
  warning: 'M10 3.5 2.5 16.5h15L10 3.5Zm0 4.5v4m0 2.5h.01',
  close: 'M5 5l10 10M15 5 5 15',
  plus: 'M10 4v12M4 10h12',
  download: 'M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 16.5h12',
  key: 'M12.5 2.5a5 5 0 0 0-4.8 6.4L2.5 14.1V17.5h3.4l.8-.8v-1.6h1.6l.8-.8v-1.6h1.6l.7-.7A5 5 0 1 0 12.5 2.5Zm1.5 3.5h.01',
  lock: 'M5.5 9V6.5a4.5 4.5 0 0 1 9 0V9m-10 0h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm5.5 3.5v2',
  'chevron-down': 'm5 7.5 5 5 5-5',
  'chevron-right': 'm7.5 5 5 5-5 5',
  'arrow-right': 'M3.5 10h13m0 0-5-5m5 5-5 5',
  'arrow-up': 'M10 16.5v-13m0 0-5 5m5-5 5 5',
  'arrow-down': 'M10 3.5v13m0 0-5-5m5 5 5-5',
  copy: 'M7.5 7.5V4.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3m-9-5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z',
  logout: 'M8 17.5H4.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1H8m4.5 11 4-3.5-4-3.5m4 3.5H7',
  sun: 'M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-11v2m0 11v2m7.5-7.5h-2m-11 0h-2m12.8-5.3-1.4 1.4M6.1 13.9l-1.4 1.4m0-10.6 1.4 1.4m7.8 7.8 1.4 1.4',
  moon: 'M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z',
  info: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm0-8v4m0-6.5h.01',
  calendar: 'M4 5.5h12a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Zm-1 4h14M7 3v4M13 3v4',
  pin: 'M10 17.5s5-4.6 5-9a5 5 0 1 0-10 0c0 4.4 5 9 5 9Zm0-7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  readonly name: IconName
  readonly size?: number
}

export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
