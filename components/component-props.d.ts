import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  HTMLAttributes,
  ReactNode,
} from 'react'

declare module '@/components/badge' {
  export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
    color?: string
    className?: string
    children?: ReactNode
  }

  export function Badge(props: BadgeProps): ReactNode
  export function BadgeButton(
    props: BadgeProps &
      (
        | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
        | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
      )
  ): ReactNode
}

declare module '@/components/button' {
  type ButtonStyleProps = {
    color?: string
    outline?: boolean
    plain?: boolean
    className?: string
    children?: ReactNode
  }

  export type ButtonProps = ButtonStyleProps &
    (
      | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
      | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
    )

  export function Button(props: ButtonProps): ReactNode
  export function TouchTarget(props: { children?: ReactNode }): ReactNode
}

declare module '@/components/divider' {
  export function Divider(props: ComponentPropsWithoutRef<'hr'> & { soft?: boolean; className?: string }): ReactNode
}

declare module '@/components/heading' {
  type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
    className?: string
    level?: 1 | 2 | 3 | 4 | 5 | 6
    children?: ReactNode
  }

  export function Heading(props: HeadingProps): ReactNode
  export function Subheading(props: HeadingProps): ReactNode
}

declare module '@/components/input' {
  export function InputGroup(props: { children?: ReactNode }): ReactNode
  export function Input(props: ComponentPropsWithoutRef<'input'> & { className?: string }): ReactNode
}

declare module '@/components/text' {
  export function Text(props: ComponentPropsWithoutRef<'p'> & { className?: string; children?: ReactNode }): ReactNode
  export function TextLink(
    props: AnchorHTMLAttributes<HTMLAnchorElement> & { className?: string; children?: ReactNode }
  ): ReactNode
  export function Strong(props: ComponentPropsWithoutRef<'strong'> & { className?: string; children?: ReactNode }): ReactNode
  export function Code(props: ComponentPropsWithoutRef<'code'> & { className?: string; children?: ReactNode }): ReactNode
}

declare module '@/components/AvatarUpload' {
  export default function AvatarUpload(props: {
    initials: string
    avatarUrl: string | null
    onUpdate?: (url: string | null) => void
  }): ReactNode
}

declare module '@/components/CompanyLogoUpload' {
  export default function CompanyLogoUpload(props: {
    logoUrl: string | null
    workspaceName?: string
    onUpdate?: (url: string | null) => void
  }): ReactNode
}
