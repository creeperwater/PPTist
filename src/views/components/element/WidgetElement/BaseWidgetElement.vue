<template>
  <div class="base-element-widget"
    :style="{
      top: elementInfo.top + 'px',
      left: elementInfo.left + 'px',
      width: elementInfo.width + 'px',
      height: elementInfo.height + 'px',
    }"
  >
    <div
      class="rotate-wrapper"
      :style="{ transform: `rotate(${elementInfo.rotate}deg)` }"
    >
      <div class="element-content" :style="{ backgroundColor: elementInfo.fill }">
        <ElementOutline
          :width="elementInfo.width"
          :height="elementInfo.height"
          :outline="elementInfo.outline"
        />
        <component
          :is="widgetComponent"
          :data="elementInfo.data"
          :width="elementInfo.width"
          :height="elementInfo.height"
          :color="elementInfo.color"
          :fill="elementInfo.fill"
          :interactive="interactive"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PPTWidgetElement } from '@/types/slides'
import { getWidgetRegistration } from '@/widgets'

import ElementOutline from '@/views/components/element/ElementOutline.vue'

const props = withDefaults(defineProps<{
  elementInfo: PPTWidgetElement
  // 是否可交互（缩略图默认不可交互；移动端播放模式等场景传 true，组件按钮可点击）
  interactive?: boolean
}>(), {
  interactive: false,
})

const widgetComponent = computed(() => getWidgetRegistration(props.elementInfo.widgetType)?.component || null)
</script>

<style lang="scss" scoped>
.base-element-widget {
  position: absolute;
}
.rotate-wrapper {
  width: 100%;
  height: 100%;
}
.element-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
