/**
 * 将秒数格式化为计时器显示文本（mm:ss，分钟可超两位，如 99:59 / 100:00）
 */
export const formatTimerValue = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
