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
import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTWidgetElement, TimerMode, WidgetTimerData, WidgetRollCallData } from '@/types/slides'
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
</style>
