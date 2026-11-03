import type { Component } from 'vue'
import type { WidgetData, WidgetType } from '@/types/slides'
import Timer from './Timer.vue'
import RollCall from './RollCall.vue'

export { formatTimerValue } from './utils'

export interface WidgetRegistration {
  type: WidgetType
  name: string
  description: string
  // 组件渲染/交互组件，接收 props: { data, width, height, color, fill, interactive }
  component: Component
  // 默认数据（随元素写入 PPT 数据，实现配置的持久保留）
  defaultData: () => WidgetData
  // 插入画布时的默认尺寸
  defaultSize: () => { width: number; height: number }
}

/**
 * 组件注册表：新增一个组件 = 编写一个 Vue 文件 + 在此注册一行
 */
export const WIDGETS: WidgetRegistration[] = [
  {
    type: 'timer',
    name: '计时器',
    description: '倒计时或秒表，上限99分59秒',
    component: Timer,
    defaultData: () => ({ mode: 'countdown', duration: 300 }),
    defaultSize: () => ({ width: 360, height: 180 }),
  },
  {
    type: 'rollCall',
    name: '随机点名',
    description: '随机抽选一个座位，上限16排16列',
    component: RollCall,
    defaultData: () => ({ rows: 3, cols: 4 }),
    defaultSize: () => ({ width: 420, height: 280 }),
  },
]

export const getWidgetRegistration = (type: WidgetType) => {
  return WIDGETS.find(widget => widget.type === type)
}
