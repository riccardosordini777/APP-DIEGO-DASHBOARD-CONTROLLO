import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  formatter?: (n: number) => string
  className?: string
}

export function AnimatedNumber({
  value,
  formatter = (n) => n.toLocaleString('it-IT'),
  className,
}: AnimatedNumberProps) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 50, damping: 12, restDelta: 0.01 })
  const display = useTransform(spring, (n) => formatter(n))

  useEffect(() => { mv.set(value) }, [mv, value])

  return <motion.span className={className}>{display}</motion.span>
}
