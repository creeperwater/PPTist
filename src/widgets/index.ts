import type { Component } from 'vue'
import type { WidgetData, WidgetType } from '@/types/slides'
import Timer from './Timer.vue'
import RollCall from './RollCall.vue'
import FuncSurface from './FuncSurface.vue'
import timerPreview from '@/assets/widgets/timer.png'
import rollCallPreview from '@/assets/widgets/rollcall.png'
import functionPreview from '@/assets/widgets/function.png'

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
  // 组件中心预览图（静态图片，避免组件中心实时渲染的性能开销）
  preview: string
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
    preview: timerPreview,
  },
  {
    type: 'rollCall',
    name: '随机点名',
    description: '随机抽选一个座位，上限16排16列',
    component: RollCall,
    defaultData: () => ({ rows: 2, cols: 4 }),
    defaultSize: () => ({ width: 420, height: 280 }),
    preview: rollCallPreview,
  },
  {
    type: 'function',
    name: '函数',
    description: '表达式绘制函数曲线与三维曲面',
    component: FuncSurface,
    defaultData: () => ({
      expressions: ['(x-a)^2'],
      varRanges: {
        x: { min: -10, max: 10 },
        y: { min: -10, max: 10 },
        z: { min: -10, max: 10 },
      },
    }),
    defaultSize: () => ({ width: 480, height: 360 }),
    preview: functionPreview,
  },
]

export const getWidgetRegistration = (type: WidgetType) => {
  return WIDGETS.find(widget => widget.type === type)
}
