<template>
  <div class="widget-style-panel">
    <template v-if="handleWidgetElement.widgetType === 'timer'">
      <div class="row">
        <div style="width: 40%;">模式：</div>
        <RadioGroup
          style="flex: 1;"
          :value="timerData.mode"
          @update:value="value => updateTimer({ mode: value as TimerMode })"
        >
          <RadioButton value="countdown">倒计时</RadioButton>
          <RadioButton value="stopwatch">秒表</RadioButton>
        </RadioGroup>
      </div>

      <template v-if="timerData.mode === 'countdown'">
        <div class="row">
          <div style="width: 40%;">时长：</div>
          <div style="flex: 1;" class="duration-group">
            <NumberInput
              :min="0"
              :max="99"
              :value="durationMinutes"
              @update:value="value => updateDuration(value, durationSeconds)"
            /> 分
            <NumberInput
              :min="0"
              :max="59"
              :value="durationSeconds"
              @update:value="value => updateDuration(durationMinutes, value)"
            /> 秒
          </div>
        </div>
      </template>
    </template>

    <template v-else-if="handleWidgetElement.widgetType === 'rollCall'">
      <div class="row">
        <div style="width: 40%;">排数：</div>
        <NumberInput
          style="width: 60%;"
          :min="1"
          :max="16"
          :value="rollCallData.rows"
          @update:value="value => updateRollCall({ rows: value })"
        />
      </div>
      <div class="row">
        <div style="width: 40%;">列数：</div>
        <NumberInput
          style="width: 60%;"
          :min="1"
          :max="16"
          :value="rollCallData.cols"
          @update:value="value => updateRollCall({ cols: value })"
        />
      </div>
    </template>

    <template v-else-if="handleWidgetElement.widgetType === 'function'">
      <div class="row">
        <div style="width: 40%;">表达式：</div>
        <div style="flex: 1;">
          <div class="expr-wrap">
            <div ref="exprBackdrop" class="expr-backdrop">
              <div
                v-for="(line, i) in exprLines"
                :key="i"
                class="expr-line"
                :class="{ error: i === firstErrorLine }"
              >{{ line || ' ' }}</div>
            </div>
            <textarea
              ref="exprTextarea"
              class="expr-input"
              rows="5"
              placeholder="每行一条，如：sin(x) * cos(y)"
              :value="exprText"
              @input="onExprInput"
              @scroll="syncBackdropScroll"
            />
          </div>
        </div>
      </div>
      <div v-for="v in varKeys" :key="v" class="row">
        <div style="width: 40%;">{{ v.toUpperCase() }} 范围：</div>
        <div style="flex: 1;" class="duration-group">
          <NumberInput
            :min="-Infinity"
            :value="functionData.varRanges[v].min"
            @update:value="value => updateVarRange(v, 'min', value)"
          />
          <span>~</span>
          <NumberInput
            :min="-Infinity"
            :value="functionData.varRanges[v].max"
            @update:value="value => updateVarRange(v, 'max', value)"
          />
        </div>
      </div>
    </template>

    <Divider />

    <div class="row">
      <div style="width: 40%;">文字颜色：</div>
      <Popover trigger="click" style="width: 60%;">
        <template #content>
          <ColorPicker
            :modelValue="handleWidgetElement.color"
            @update:modelValue="value => updateWidget({ color: value })"
          />
        </template>
        <ColorButton :color="handleWidgetElement.color" />
      </Popover>
    </div>
    <div class="row">
      <div style="width: 40%;">背景颜色：</div>
      <Popover trigger="click" style="width: 60%;">
        <template #content>
          <ColorPicker
            :modelValue="handleWidgetElement.fill || '#ffffff'"
            @update:modelValue="value => updateWidget({ fill: value })"
          />
        </template>
        <ColorButton :color="handleWidgetElement.fill || ''" />
      </Popover>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import * as M from 'mathjs'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTWidgetElement, TimerMode, WidgetTimerData, WidgetRollCallData, WidgetFunctionData } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

import ColorButton from '@/components/ColorButton.vue'
import ColorPicker from '@/components/ColorPicker/index.vue'
import Divider from '@/components/Divider.vue'
import NumberInput from '@/components/NumberInput.vue'
import Popover from '@/components/Popover.vue'
import RadioButton from '@/components/RadioButton.vue'
import RadioGroup from '@/components/RadioGroup.vue'

const slidesStore = useSlidesStore()
const { handleElement } = storeToRefs(useMainStore())

const handleWidgetElement = handleElement as Ref<PPTWidgetElement>

const timerData = computed(() => handleWidgetElement.value.data as WidgetTimerData)
const rollCallData = computed(() => handleWidgetElement.value.data as WidgetRollCallData)
const functionData = computed(() => handleWidgetElement.value.data as WidgetFunctionData)

const { addHistorySnapshot } = useHistorySnapshot()

const updateWidget = (props: Partial<PPTWidgetElement>) => {
  if (!handleElement.value) return
  slidesStore.updateElement({ id: handleElement.value.id, props })
  addHistorySnapshot()
}

const updateTimer = (data: Partial<WidgetTimerData>) => {
  if (!handleWidgetElement.value) return
  updateWidget({ data: { ...timerData.value, ...data } })
}

const durationMinutes = computed(() => Math.floor(timerData.value.duration / 60))
const durationSeconds = computed(() => timerData.value.duration % 60)

// 钳制到合法范围：分 0~99、秒 0~59（总时长上限 99:59），杜绝负数/越界
const updateDuration = (minutes: number, seconds: number) => {
  const m = Math.min(99, Math.max(0, Math.round(minutes) || 0))
  const s = Math.min(59, Math.max(0, Math.round(seconds) || 0))
  updateTimer({ duration: m * 60 + s })
}

// 钳制到合法范围：排/列 1~16
const updateRollCall = (data: Partial<WidgetRollCallData>) => {
  if (!handleWidgetElement.value) return
  const merged = { ...rollCallData.value, ...data }
  updateWidget({
    data: {
      ...merged,
      rows: Math.min(16, Math.max(1, Math.round(merged.rows) || 1)),
      cols: Math.min(16, Math.max(1, Math.round(merged.cols) || 1)),
    },
  })
}

// ---- 函数组件：表达式与自变量范围 ----

const varKeys: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z']

const exprText = computed(() => functionData.value.expressions.join('\n'))

// 每行一条表达式，随输入实时写入 data（空行保留，渲染端会忽略）
const onExprInput = (e: Event) => {
  const text = (e.target as HTMLTextAreaElement).value
  updateWidget({ data: { ...functionData.value, expressions: text.split('\n') } })
}

const exprLines = computed(() => exprText.value.split('\n'))

// 与渲染端一致的判定：parse 抛异常，或同一行 XYZ 变量超过 2 个（该行不会被绘制）
const isExprError = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed) return false
  try {
    const node = M.parse(trimmed)
    const syms = new Set<string>()
    node.filter((n: any) => n.isSymbolNode).forEach((n: any) => syms.add(n.name))
    return ['x', 'y', 'z'].filter(v => syms.has(v)).length > 2
  } catch {
    return true
  }
}

// 只标记第一个出错行；修好后自动顺延到下一个出错行
const firstErrorLine = computed(() => exprLines.value.findIndex(isExprError))

const exprBackdrop = ref<HTMLElement | null>(null)
const exprTextarea = ref<HTMLTextAreaElement | null>(null)

// 背景镜像层跟随 textarea 滚动
const syncBackdropScroll = () => {
  if (exprBackdrop.value && exprTextarea.value) {
    exprBackdrop.value.scrollTop = exprTextarea.value.scrollTop
  }
}

// 输入区最小高度 = 内容撑开的高度，多行内容不被固定行数截断
const syncExprHeight = () => {
  const el = exprTextarea.value
  if (!el) return
  el.style.minHeight = '0px'
  el.style.minHeight = `${el.scrollHeight}px`
}
watch(exprText, () => nextTick(syncExprHeight), { immediate: true })

// 更新某自变量的范围；非法值忽略，上下限颠倒自动交换
const updateVarRange = (v: 'x' | 'y' | 'z', key: 'min' | 'max', value: number) => {
  if (!Number.isFinite(value)) return
  const pair = { ...functionData.value.varRanges[v], [key]: value }
  if (pair.min > pair.max) {
    const temp = pair.min
    pair.min = pair.max
    pair.max = temp
  }
  updateWidget({ data: { ...functionData.value, varRanges: { ...functionData.value.varRanges, [v]: pair } } })
}
</script>

<style lang="scss" scoped>
.row {
  width: 100%;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.duration-group {
  display: flex;
  align-items: center;
  gap: 5px;

  .number-input {
    flex: 1;
  }
}
.expr-wrap {
  position: relative;
}
// 背景镜像层：与 textarea 同排版、文字透明，只有出错行涂红
.expr-backdrop {
  position: absolute;
  inset: 0;
  padding: 5px 7px; // textarea 的 4px 6px 内边距 + 1px 边框
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: none;
}
.expr-line {
  color: transparent;
  font-size: 12px;
  font-family: ui-monospace, Consolas, monospace;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;

  &.error {
    // 左右顶到输入框边缘：抵消镜像层内边距，文字排版不变
    margin: 0 -7px;
    padding: 0 7px;
    background-color: rgba(214, 48, 49, 0.15);
    box-shadow: inset 2px 0 0 #d63031;
  }
}
.expr-input {
  position: relative;
  display: block;
  box-sizing: border-box; // 全局重置未覆盖 textarea（默认 content-box），修复右缘溢出
  width: 100%;
  padding: 4px 6px;
  background: transparent;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  outline: 0; // 去掉浏览器默认的橘色 focus ring，与 NumberInput 统一
  font-size: 12px;
  font-family: ui-monospace, Consolas, monospace;
  line-height: 1.5;
  resize: vertical;
  transition: border-color .25s;

  // 与 NumberInput 一致：悬停/聚焦时边框渐变为主题红
  &:hover, &:focus {
    border-color: $themeColor;
  }
}
</style>
