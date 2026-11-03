<template>
  <div class="widget-rollcall" :style="{ backgroundColor: fill }">
    <div class="result" :style="{ color, fontSize: resultFont + 'px' }">{{ resultText }}</div>
    <div class="matrix" :style="matrixStyle">
      <div
        v-for="(_, i) in seats"
        :key="i"
        class="seat"
        :class="{ 'lit': litIndex === i }"
        :style="seatStyle"
      ></div>
    </div>
    <div class="controls" :class="{ 'static': !interactive }">
      <button
        class="control-btn"
        :style="{ width: btnSize + 'px', height: btnSize + 'px', borderRadius: btnSize / 2 + 'px' }"
        :title="animating ? '终止' : '开始'"
        @mousedown.stop
        @touchstart.stop
        @click.stop="e => emit('interact', e)"
        @click="handleClick()"
      >
        <svg v-if="!animating" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import type { WidgetRollCallData } from '@/types/slides'

const props = withDefaults(defineProps<{
  data: WidgetRollCallData
  width: number
  height: number
  color?: string
  fill?: string
  // 是否可交互（编辑画布/移动端/放映模式下为 true，点击抽人）
  interactive?: boolean
}>(), {
  color: '#333',
  fill: 'transparent',
  interactive: false,
})

const emit = defineEmits<{
  // 交互区被按下（已阻止冒泡，由外层决定是否选中元素）
  (event: 'interact', payload: MouseEvent | TouchEvent): void
}>()

const rows = computed(() => Math.max(1, props.data.rows | 0))
const cols = computed(() => Math.max(1, props.data.cols | 0))

// 抽人状态仅存在于组件内部，不写入 PPT 数据
const litIndex = ref(-1) // 当前亮起的座位索引，-1 表示无
const animating = ref(false)
let timeout: ReturnType<typeof setTimeout> | null = null

const seats = computed(() => new Array(rows.value * cols.value).fill(0))

// 标题字号与按钮尺寸随元素尺寸缩放
const resultFont = computed(() => Math.max(11, props.height * 0.09))
const btnSize = computed(() => Math.max(22, Math.min(props.height * 0.22, props.width * 0.3, 56)))

const gap = computed(() => Math.max(2, Math.min(props.width, props.height) * 0.012))

// 座位格尺寸：同时受宽高约束，行列过多时自动缩小
const seatSize = computed(() => {
  const controlsH = btnSize.value + 14
  const resultH = resultFont.value * 1.6 + 8
  const byWidth = (props.width - 20 - gap.value * (cols.value - 1)) / cols.value
  const byHeight = (props.height - resultH - controlsH - 12 - gap.value * (rows.value - 1)) / rows.value
  return Math.max(2, Math.min(byWidth, byHeight))
})

const matrixStyle = computed(() => ({
  gridTemplateColumns: `repeat(${cols.value}, ${seatSize.value}px)`,
  gap: gap.value + 'px',
}))

const seatStyle = computed(() => ({
  width: seatSize.value + 'px',
  height: seatSize.value + 'px',
}))

// 标题显示当前亮起格子的排、列（第一行即第一排）
const resultText = computed(() => {
  if (litIndex.value === -1) return 'N排M列'
  const row = Math.floor(litIndex.value / cols.value) + 1
  const col = litIndex.value % cols.value + 1
  return `${row}排${col}列`
})

// 抽人：格子随机跳变（每次必换格），间隔线性变长（约 1/x 速度衰减），短拖尾后定格
const startDraw = () => {
  const total = rows.value * cols.value
  if (total <= 0) return

  // 只有一个格子时无从跳变，直接选中
  if (total === 1) {
    litIndex.value = 0
    return
  }

  animating.value = true
  const target = Math.floor(Math.random() * total)
  const STEPS = 15
  let step = 0

  const next = () => {
    // 从其余格子中随机挑下一个，保证跳变不落在当前格
    let idx = Math.floor(Math.random() * total)
    while (idx === litIndex.value) idx = Math.floor(Math.random() * total)
    litIndex.value = idx

    step++
    if (step < STEPS) {
      // 间隔随步数线性增长（速度约按 1/x 衰减）
      timeout = setTimeout(next, 35 + step * 18)
    }
    else {
      litIndex.value = target
      animating.value = false
    }
  }
  next()
}

const resetState = () => {
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  animating.value = false
  litIndex.value = -1
}

// 按钮两态：▶ 开始抽人 → ■ 中途终止并重置（定格后自动回到 ▶）
const handleClick = () => {
  if (!props.interactive) return
  if (animating.value) resetState()
  else startDraw()
}

// 教室布局（排数/列数）变化时重置
watch([rows, cols], resetState)

onUnmounted(resetState)
</script>

<style lang="scss" scoped>
.widget-rollcall {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.result {
  width: 100%;
  padding: 4px 10px 2px;
  text-align: center;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.matrix {
  flex: 1;
  display: grid;
  align-content: center;
  justify-content: center;
}
.seat {
  background-color: #e2e4e8;
  border-radius: 2px;

  &.lit {
    background-color: $themeColor;
  }
}
.controls {
  display: flex;
  justify-content: center;
  padding: 2px 0 10px;

  // 编辑态/缩略图下按钮仅作展示，点击穿透为选中元素
  &.static {
    pointer-events: none;
  }
}
// 与计时器同款圆形按钮
.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background-color: $themeColor;
  cursor: pointer;

  svg {
    display: block;
    height: 45%;
    fill: #fff;
  }
}
</style>
