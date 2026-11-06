<template>
  <div class="widget-function" :class="{ 'static': !interactive }" :style="{ backgroundColor: fill }">
    <div ref="elCharts" class="fs-charts">
      <!-- 三维图例：横排一行，点击切换显隐，取消项变灰 -->
      <div v-if="dim === '3d' && surfaceNames.length" class="fs-legend3d" @mousedown.stop @touchstart.stop @click.stop="e => emit('interact', e)">
        <button
          v-for="name in surfaceNames"
          :key="name"
          type="button"
          class="fs-legend-item"
          :class="{ off: legendSelected[name] === false }"
          :aria-pressed="legendSelected[name] !== false"
          @click="toggleLegend(name)"
        >
          <span class="fs-lmarker" aria-hidden="true"></span>
          <span class="fs-ltext">{{ name }}</span>
        </button>
      </div>

      <div ref="el2d" class="fs-view" :style="{ visibility: dim === '2d' ? 'visible' : 'hidden' }"></div>
      <div ref="el3d" class="fs-view" :style="{ visibility: dim === '3d' ? 'visible' : 'hidden' }"></div>
    </div>

    <!-- 参数滑块：表达式中 xyz 之外的自由符号自动抽离到这里（运行时交互，不落盘） -->
    <div
      v-if="paramList.length"
      class="fs-params"
      @mousedown.stop
      @touchstart.stop
      @click.stop="e => emit('interact', e)"
    >
      <div v-for="p in paramList" :key="p.name" class="fs-param">
        <span class="fs-pname">{{ p.name }}</span>
        <input
          class="fs-prange"
          type="range"
          :min="p.min"
          :max="p.max"
          :step="p.step"
          v-model.number="paramValues[p.name]"
          :aria-label="`参数 ${p.name} 滑块`"
        />
        <span class="fs-pval">{{ fmtNum(paramValues[p.name]) }}</span>
        <span class="fs-pin">∈&nbsp;[</span>
        <input
          class="fs-pnum"
          type="number"
          step="any"
          v-model.number="paramRanges[p.name].min"
          :aria-label="`参数 ${p.name} 最小值`"
        />
        <span class="fs-psep">,</span>
        <input
          class="fs-pnum"
          type="number"
          step="any"
          v-model.number="paramRanges[p.name].max"
          :aria-label="`参数 ${p.name} 最大值`"
        />
        <span class="fs-pin">]</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 函数渲染组件 —— math.js 表达式（多条）→ 二维多曲线 / 三维多曲面
 *
 * 自 func-surface-demo 的 FuncSurface.vue 移植，适配 PPTist 组件范式：
 * 表达式与自变量范围存入元素 data（右侧面板编辑，随 PPT 持久化），
 * 非 xyz 符号自动抽离为运行时参数滑块（不落盘）。
 *
 * 维度判定：表达式涉及 x/y/z 中的 1 个 → 二维曲线；2 个 → 三维曲面（缺失的变量名作为值轴）；
 * 同一行出现 3 个 → 报错（最多支持两个变量）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import 'echarts-gl'
import * as M from 'mathjs'
import type { WidgetFunctionData } from '@/types/slides'

const props = withDefaults(defineProps<{
  data: WidgetFunctionData
  width?: number
  height?: number
  color?: string
  fill?: string
  // 是否可交互（编辑画布/移动端/放映模式下为 true）
  interactive?: boolean
}>(), { interactive: false })

const emit = defineEmits<{
  (e: 'interact', event: MouseEvent | TouchEvent): void
}>()

const elCharts = ref<HTMLElement>()
const el2d = ref<HTMLElement>()
const el3d = ref<HTMLElement>()

const XYZ = ['x', 'y', 'z']

// 当前表达式组涉及的变量（xyz 序）与维度
const presentVars = ref<string[]>(['x'])
const dim = ref<'2d' | '3d'>('2d')

// 三维图例显隐状态（name -> 是否显示）。echarts 原生 legend 对置灰支持不佳（置灰项直接消失），
// 因此图例自绘：点击项 = 切换该曲面显示，取消项变灰
const legendSelected = ref<Record<string, boolean>>({})
const surfaceNames = ref<string[]>([])

const toggleLegend = (name: string) => {
  const cur = legendSelected.value[name] !== false
  legendSelected.value = { ...legendSelected.value, [name]: !cur }
  lastRenderKey = ''
  render()
}

// ---- 参数滑块：非 xyz 符号 -> {min,max} / 当前取值 ----
const paramRanges = reactive<Record<string, { min: number; max: number }>>({})
const paramValues = reactive<Record<string, number>>({})
const paramList = computed(() =>
  Object.keys(paramValues).sort().map(name => ({
    name,
    min: paramRanges[name].min,
    max: paramRanges[name].max,
    step: 0.01,
  })),
)

let chart2d: echarts.ECharts | null = null
let chart3d: echarts.ECharts | null = null
let ro: ResizeObserver | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let base3dSet = false
let lastRenderKey = ''

// viridis 色带（3D 曲面高度映射）
const PALETTE = ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725']
// 二维曲线色板：首位为应用主题色，其余沿用 echarts 默认色板
const C2D = ['#d14424', '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4']
const AXIS_TEXT = '#64748b'
const AXIS_LINE = '#cbd5e1'

// math.js 求值结果 → 有限数值；复数（如负数开方）/NaN/∞ 一律视为无效点
const safeNum = (v: unknown): number | null => {
  if (v === null || v === undefined || typeof v === 'object') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// 求值 scope：当前变量 + 滑块参数
const makeScope = () => ({ ...paramValues })

const fmtNum = (v: number) => Number(v).toFixed(2)

/* ---------------- 参数滑块 / 变量范围 钳制 ---------------- */

const syncParams = (names: Set<string>) => {
  for (const name of names) {
    if (!(name in paramValues)) {
      paramRanges[name] = { min: -10, max: 10 }
      paramValues[name] = 1
    }
  }
  for (const name of Object.keys(paramValues)) {
    if (!names.has(name)) {
      delete paramValues[name]
      delete paramRanges[name]
    }
  }
}

// 非法输入自动修复、上下限颠倒自动交换、当前值钳回区间
const clampPair = (pair: { min: number; max: number }, dflt: [number, number]): [number, number] => {
  let { min, max } = pair
  if (!Number.isFinite(min)) min = pair.min = dflt[0]
  if (!Number.isFinite(max)) max = pair.max = dflt[1]
  if (min > max) {
    pair.min = max
    pair.max = min
    ;[min, max] = [max, min]
  }
  return [min, max]
}

watch(paramRanges, () => {
  for (const name of Object.keys(paramRanges)) {
    const [min, max] = clampPair(paramRanges[name], [-10, 10])
    const v = paramValues[name]
    if (!Number.isFinite(v)) paramValues[name] = (min + max) / 2
    else if (v < min) paramValues[name] = min
    else if (v > max) paramValues[name] = max
  }
}, { deep: true })


/* ---------------- 二维：单变量曲线 ---------------- */

const render2d = (list: any[]) => {
  const h = presentVars.value[0] ?? 'x'
  const ranges = props.data.varRanges as Record<string, { min: number; max: number }>
  const [a, b] = [ranges[h].min, ranges[h].max]
  const N = Math.min(800, Math.max(120, 57 * 8))
  const series: any[] = []
  const allYs: number[] = []

  list.forEach((it, idx) => {
    const color = it.color || C2D[idx % C2D.length]
    const scope = makeScope()
    const pts: [number, number | null][] = []
    let count = 0
    for (let i = 0; i < N; i++) {
      const t = a + ((b - a) * i) / (N - 1)
      scope[h] = t
      let y: number | null = null
      try {
        y = safeNum(it.compiled.evaluate(scope))
      }
      catch {
        y = null
      }
      if (y !== null) {
        count++
        allYs.push(y)
        pts.push([Number(t.toFixed(3)), Number(y.toFixed(4))])
      }
      else {
        pts.push([Number(t.toFixed(3)), null])
      }
    }
    it.count = count
    series.push({
      name: it.expr,
      type: 'line',
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2, color },
      color,
      data: pts,
    })
  })

  // y 轴范围：所有曲线的点合并后按 2%~98% 分位截断
  let ymin = -1
  let ymax = 1
  if (allYs.length) {
    const ys = [...allYs].sort((p, q) => p - q)
    ymin = ys[0]
    ymax = ys[ys.length - 1]
    if (ys.length > 24) {
      const lo = ys[Math.floor(ys.length * 0.02)]
      const hi = ys[Math.floor(ys.length * 0.98)]
      if (hi > lo) {
        ymin = lo
        ymax = hi
      }
    }
    const pad = (ymax - ymin) * 0.15 || 1
    ymin = Number((ymin - pad).toFixed(2))
    ymax = Number((ymax + pad).toFixed(2))
  }

  chart2d!.setOption(
    {
      legend: { show: true, type: 'scroll', top: 8, left: 8, textStyle: { color: AXIS_TEXT, fontSize: 11 } },
      grid: { left: 6, right: 12, top: 36, bottom: 0, containLabel: true },
      xAxis: { min: a, max: b, name: h },
      yAxis: { min: ymin, max: ymax, name: h === 'x' ? 'y' : 'f' },
      series,
    },
    { replaceMerge: 'series' },
  )
}

/* ---------------- 三维：双变量曲面（缺失的 xyz 符号作为值轴名） ---------------- */

const axis = (name: string) => ({
  type: 'value' as const,
  name,
  nameTextStyle: { color: AXIS_TEXT },
  axisLine: { lineStyle: { color: AXIS_LINE } },
  axisLabel: { textStyle: { color: AXIS_TEXT } },
  splitLine: { lineStyle: { color: AXIS_LINE, opacity: 0.5 } },
})

const render3d = (list: any[]) => {
  const [v1, v2] = presentVars.value
  const missing = XYZ.find(v => !presentVars.value.includes(v)) ?? 'z'
  const ranges = props.data.varRanges as Record<string, { min: number; max: number }>
  const r1 = ranges[v1]
  const r2 = ranges[v2]
  const n = Math.min(120, Math.max(20, 57))
  const allSeries: any[] = []
  let zmin = Infinity
  let zmax = -Infinity

  list.forEach(it => {
    const scope = makeScope()
    const data: [number, number, number][] = []
    let count = 0
    // surface 系列要求完整网格（外层 v1、内层 v2），无效点用 NaN 占位
    for (let i = 0; i < n; i++) {
      const t1 = r1.min + ((r1.max - r1.min) * i) / (n - 1)
      scope[v1] = t1
      for (let j = 0; j < n; j++) {
        const t2 = r2.min + ((r2.max - r2.min) * j) / (n - 1)
        scope[v2] = t2
        let z = NaN
        try {
          const v = safeNum(it.compiled.evaluate(scope))
          if (v !== null) {
            z = v
            count++
            if (z < zmin) zmin = z
            if (z > zmax) zmax = z
          }
        }
        catch {
          z = NaN
        }
        data.push([Number(t1.toFixed(2)), Number(t2.toFixed(2)), Number(z.toFixed(3))])
      }
    }
    it.count = count
    allSeries.push({
      name: it.expr,
      type: 'surface',
      shading: 'color',
      wireframe: { show: true, lineStyle: { color: 'rgba(255,255,255,0.22)', width: 1 } },
      data,
    })
  })

  if (!Number.isFinite(zmin)) {
    zmin = 0
    zmax = 1
  }

  // 图例点击控制显隐：只把选中的曲面放进 series；色标范围按全部曲面计算保持稳定
  const series = allSeries.filter(s => legendSelected.value[s.name] !== false)

  const update = {
    visualMap: { min: zmin, max: zmax },
    xAxis3D: axis(v1),
    yAxis3D: axis(v2),
    zAxis3D: axis(missing),
    series,
  }

  // viewControl 只在首次传入，之后合并更新，避免把用户已旋转的视角复位
  if (!base3dSet) {
    chart3d!.setOption(
      {
        animation: false,
        tooltip: {
          formatter: (q: any) =>
            q.value
              ? `${presentVars.value[0]} = ${q.value[0].toFixed(2)}<br>${presentVars.value[1]} = ${q.value[1].toFixed(2)}<br>${missing} = ${q.value[2].toFixed(3)}`
              : '',
        },
        visualMap: {
          show: false,
          dimension: 2,
          min: zmin,
          max: zmax,
          inRange: { color: PALETTE },
        },
        grid3D: {
          boxWidth: 100,
          boxDepth: 100,
          boxHeight: 55,
          environment: 'none',
          viewControl: {
            distance: 235,
            alpha: 28,
            beta: 40,
            autoRotateSpeed: 12,
            minDistance: 60,
            maxDistance: 600,
          },
          axisLine: { lineStyle: { color: AXIS_LINE } },
          splitLine: { lineStyle: { color: AXIS_LINE, opacity: 0.5 } },
        },
        xAxis3D: axis(v1),
        yAxis3D: axis(v2),
        zAxis3D: axis(missing),
        series,
      },
      { replaceMerge: 'series' },
    )
    base3dSet = true
  }
  else {
    chart3d!.setOption(update, { replaceMerge: 'series' })
  }
}

/* ---------------- 渲染入口：逐条解析、错误隔离、按 xyz 个数定维度 ---------------- */

const render = () => {
  if (!chart2d || !chart3d) return

  const list: string[] = props.data.expressions || []

  // 逐条解析，单条失败不影响其他
  const items = list.map(src => {
    const expr = String(src ?? '').trim()
    if (!expr) return { expr, ok: true, empty: true, compiled: null as any, vars: [] as string[], node: null as any }
    try {
      const node = M.parse(expr)
      const syms = new Set<string>()
      node.filter((n: any) => n.isSymbolNode).forEach((n: any) => syms.add(n.name))
      const vars = XYZ.filter(v => syms.has(v))
      return { expr, ok: true, empty: false, compiled: node.compile(), node, vars }
    }
    catch {
      return { expr, ok: false, empty: false, compiled: null as any, vars: [] as string[], node: null as any }
    }
  })

  const drawable = items.filter(it => it.ok && !it.empty)
  const union = new Set<string>()
  drawable.forEach(it => it.vars.forEach(v => union.add(v)))
  presentVars.value = XYZ.filter(v => union.has(v))
  surfaceNames.value = drawable.map(it => it.expr)

  dim.value = presentVars.value.length === 2 ? '3d' : '2d'

  // 参数抽离：xyz 之外的自由符号统一收集成滑块
  const names = new Set<string>()
  drawable.forEach(it => {
    it.node.filter((n: any) => n.isSymbolNode && !XYZ.includes(n.name) && (M as any)[n.name] === undefined)
      .forEach((n: any) => names.add(n.name))
  })
  syncParams(names)

  // 入参（含滑块值、变量范围）没变就跳过采样
  const key = [props.data.expressions.join('\u0001'), JSON.stringify(props.data.varRanges), JSON.stringify(paramValues)].join('|')
  if (key === lastRenderKey) return
  lastRenderKey = key

  if (!drawable.length) {
    chart2d.setOption({ series: [] }, { replaceMerge: 'series' })
    chart3d.setOption({ series: [] }, { replaceMerge: 'series' })
  }
  else if (dim.value === '2d') {
    render2d(drawable)
  }
  else {
    render3d(drawable)
  }
}

watch(() => props.data.expressions, () => {
  clearTimeout(timer as any)
  timer = setTimeout(render, 250)
})
watch(() => props.data.varRanges, () => {
  clearTimeout(timer as any)
  timer = setTimeout(render, 150)
}, { deep: true })

// 滑块拖动：节流刷新 —— 拖动过程中按固定间隔出图（3D 重、间隔放长），拖动即刷但不逐帧刷；
// 防抖做不到这点（连续拖动会一直被顶掉，停手才渲染），节流则保证拖动中周期性刷新 + 末值必渲染
let thTimer: ReturnType<typeof setTimeout> | null = null
let lastRenderAt = 0
const scheduleParamRender = () => {
  if (thTimer) return
  const interval = dim.value === '3d' ? 150 : 80
  const wait = interval - (Date.now() - lastRenderAt)
  if (wait <= 0) {
    lastRenderAt = Date.now()
    render()
    return
  }
  thTimer = setTimeout(() => {
    thTimer = null
    lastRenderAt = Date.now()
    render()
  }, wait)
}
watch(paramValues, scheduleParamRender, { deep: true })

onMounted(() => {
  chart2d = echarts.init(el2d.value)
  chart2d.setOption({
    animation: false,
    tooltip: { trigger: 'axis', confine: true },
    xAxis: {
      type: 'value',
      min: -6,
      max: 6,
      name: 'x',
      nameTextStyle: { color: AXIS_TEXT },
      axisLine: { lineStyle: { color: AXIS_LINE } },
      axisLabel: { color: AXIS_TEXT, fontSize: 11 },
      splitLine: { lineStyle: { color: AXIS_LINE, opacity: 0.35 } },
    },
    yAxis: {
      type: 'value',
      name: 'y',
      nameTextStyle: { color: AXIS_TEXT },
      axisLine: { lineStyle: { color: AXIS_LINE } },
      axisLabel: { color: AXIS_TEXT, fontSize: 11 },
      splitLine: { lineStyle: { color: AXIS_LINE, opacity: 0.35 } },
    },
    series: [],
  })

  chart3d = echarts.init(el3d.value)

  render()
  ro = new ResizeObserver(() => {
    chart2d?.resize()
    chart3d?.resize()
  })
  ro.observe(elCharts.value as HTMLElement)
})

onBeforeUnmount(() => {
  clearTimeout(timer as any)
  clearTimeout(thTimer as any)
  ro?.disconnect()
  chart2d?.dispose()
  chart3d?.dispose()
  chart2d = null
  chart3d = null
})
</script>

<style lang="scss" scoped>
.widget-function {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &.static .fs-params {
    pointer-events: none;
  }
}

.fs-charts {
  flex: 1;
  min-height: 0;
  position: relative;
  width: 100%;
}

.fs-view {
  position: absolute;
  inset: 0;
}

/* ---- 三维自绘图例（横排、点击置灰切换） ---- */
.fs-legend3d {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 14px;
  max-width: 70%;
}

.fs-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  cursor: pointer;
  min-width: 0;

  &.off {
    opacity: 0.45;

    .fs-lmarker {
      filter: grayscale(1);
    }

    .fs-ltext {
      color: #94a3b8;
    }
  }
}

.fs-lmarker {
  flex: none;
  width: 28px;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(90deg, #440154, #31688e, #1fa187, #a0da39, #fde725);
}

.fs-ltext {
  font-size: 11px;
  color: #64748b;
  font-family: ui-monospace, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- 参数滑块：浮在图下方 ---- */
.fs-params {
  position: relative;
  z-index: 10;
  flex: none;
  padding: 6px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fs-param {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fs-pname {
  flex: none;
  min-width: 18px;
  font-family: ui-monospace, Consolas, 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.fs-prange {
  flex: 1;
  min-width: 0;
  accent-color: #d14424;
  cursor: pointer;
}

.fs-pval {
  flex: none;
  width: 52px;
  text-align: right;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  color: #475569;
}

.fs-pnum {
  flex: none;
  width: 62px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 3px 6px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  color: #0f172a;
  background: #fff;

  &:focus {
    outline: 2px solid #4c6ef5;
    outline-offset: -1px;
  }
}

.fs-psep,
.fs-pin {
  flex: none;
  color: #94a3b8;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}
</style>
