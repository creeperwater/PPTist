<template>
  <div class="widget-timer" :style="{ backgroundColor: fill }">
    <div
      class="time-display"
      :style="{ color, fontSize: fontSize + 'px' }"
    >{{ displayTime }}</div>
    <div
      class="controls"
      :class="{ 'static': !interactive }"
    >
      <div
        class="control-btn"
        :class="{ 'pill': pillMode }"
        :style="{
          width: (pillMode ? btnSize * 2 : btnSize) + 'px',
          height: btnSize + 'px',
          borderRadius: btnSize / 2 + 'px',
        }"
        @mousedown.stop
        @touchstart.stop
        @click.stop="e => emit('interact', e)"
      >
        <!-- 终止状态：单个停止按钮，点击归零 -->
        <button v-if="finished" class="btn-action" title="停止" @click="stopAndReset()">
          <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
        </button>
        <!-- 初始状态：开始 -->
        <button v-else-if="!pillMode" class="btn-action" title="开始" @click="startOrResume()">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <!-- 运行/暂停状态：胶囊（左暂停‖或继续▶，右停止■） -->
        <template v-else>
          <button v-if="running" class="btn-action" title="暂停" @click="pause()">
            <svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          </button>
          <button v-else class="btn-action" title="继续" @click="startOrResume()">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button class="btn-action" title="停止" @click="stopAndReset()">
            <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import type { WidgetTimerData } from '@/types/slides'
import { formatTimerValue } from './utils'

const props = withDefaults(defineProps<{
  data: WidgetTimerData
  width: number
  height: number
  color?: string
  fill?: string
  // 是否可交互（编辑画布/移动端/放映模式下为 true，点击开始/停止/重置）
  interactive?: boolean
}>(), {
  color: '#333',
  fill: 'transparent',
  interactive: false,
})

const emit = defineEmits<{
  // 按钮交互区被按下（已阻止冒泡，由外层决定是否选中元素）
  (event: 'interact', payload: MouseEvent | TouchEvent): void
}>()

// 运行状态仅存在于放映时的组件内部，不写入 PPT 数据
const elapsed = ref(0) // 已走过的秒数
const running = ref(false)
const finished = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

// 倒计时剩余秒数
const remaining = computed(() => {
  if (props.data.mode === 'stopwatch') return elapsed.value
  return Math.max(0, props.data.duration - elapsed.value)
})

const displayTime = computed(() => formatTimerValue(remaining.value))

// 下方按钮区固定存在（编辑/缩略图/放映视觉一致）
// 字号同时受高度与宽度约束，窄元素时自动缩小避免溢出
const fontSize = computed(() => {
  const byHeight = props.height * 0.4
  const byWidth = props.width / (displayTime.value.length * 0.62)
  return Math.max(12, Math.min(byHeight, byWidth))
})

// 圆形按钮尺寸（随元素宽高缩放）
const btnSize = computed(() => {
  return Math.max(28, Math.min(props.height * 0.3, props.width * 0.3, 64))
})

// 胶囊形态：运行中或已暂停（有进度且未终止）；初始/终止为圆形
const pillMode = computed(() => (running.value || elapsed.value > 0) && !finished.value)

// 计时上限 99:59（5999 秒），到头自动进入终止状态
const TIMER_MAX = 5999

const startOrResume = () => {
  if (!props.interactive || running.value) return
  running.value = true
  interval = setInterval(() => {
    elapsed.value += 1
    const done = props.data.mode === 'countdown'
      ? remaining.value <= 0
      : elapsed.value >= TIMER_MAX
    if (done) {
      halt()
      finished.value = true
    }
  }, 1000)
}

const halt = () => {
  running.value = false
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}

// 暂停：停住当前进度，保持胶囊形态（左继续右停止）
const pause = () => {
  if (!props.interactive) return
  halt()
}

// 停止：停表并归零，回到初始形态
const stopAndReset = () => {
  if (!props.interactive) return
  resetState()
}

const resetState = () => {
  halt()
  finished.value = false
  elapsed.value = 0
}

// 配置（模式/时长）变化时重置为新的初始状态
watch(() => props.data.mode, resetState)
watch(() => props.data.duration, resetState)

onUnmounted(halt)
</script>

<style lang="scss" scoped>
.widget-timer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.time-display {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.controls {
  display: flex;
  justify-content: center;
  padding: 0 10px 12px;

  // 编辑态/缩略图下按钮仅作展示，点击穿透为选中元素
  &.static {
    pointer-events: none;
  }
}
// 圆形 ↔ 胶囊（width = 2d, height = d, radius = d/2）
// 圆形时 radius 50% 数值上等于 d/2，与胶囊一致，因此只需对 width 做过渡
.control-btn {
  display: flex;
  align-items: stretch;
  overflow: hidden;
  background-color: $themeColor;
  transition: width $transitionDelay, filter .2s, transform .2s, box-shadow .2s;

  &:hover {
    filter: brightness(1.15);
    transform: scale(1.06);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22);
  }
  &:active {
    transform: scale(0.95);
  }
}
.btn-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color .15s;

  svg {
    display: block;
    height: 45%;
    fill: #fff;
  }
}
// 双按钮胶囊形态：两图标轻微向中缝靠拢，各自半区 hover 高亮以区分是暂停还是停止
.control-btn.pill {
  .btn-action:first-child svg {
    transform: translateX(12%);
  }
  .btn-action:last-child svg {
    transform: translateX(-12%);
  }
  .btn-action:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }
}
</style>
