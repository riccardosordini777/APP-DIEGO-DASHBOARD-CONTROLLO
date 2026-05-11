import { motion } from 'framer-motion'

interface BlurFadeProps {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: keyof React.JSX.IntrinsicElements
}

export function BlurFade({ children, delay = 0, className, as = 'div' }: BlurFadeProps) {
  const Component = motion[as as 'div'] as typeof motion.div
  return (
    <Component
      initial={{ opacity: 0, filter: 'blur(8px)', y: 6 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </Component>
  )
}
