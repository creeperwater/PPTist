<template>
  <div class="editable-element-widget"
    :class="{ 'lock': elementInfo.lock }"
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
      <div
        class="element-content"
        :style="{ backgroundColor: elementInfo.fill }"
        v-contextmenu="contextmenus"
        @mousedown="$event => handleSelectElement($event)"
        @touchstart="$event => handleSelectElement($event)"
      >
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
          :interactive="true"
          @interact="handleInteract"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PPTWidgetElement } from '@/types/slides'
import type { ContextmenuItem } from '@/components/Contextmenu/types'
import { getWidgetRegistration } from '@/widgets'

import ElementOutline from '@/views/components/element/ElementOutline.vue'

const props = defineProps<{
  elementInfo: PPTWidgetElement
  selectElement: (e: MouseEvent | TouchEvent, element: PPTWidgetElement, canMove?: boolean) => void
  contextmenus: () => ContextmenuItem[] | null
}>()

const widgetComponent = computed(() => getWidgetRegistration(props.elementInfo.widgetType)?.component || null)

// canMove=false：选中元素（出现操作框）但按住按钮不启动拖动
const handleSelectElement = (e: MouseEvent | TouchEvent, canMove = true) => {
  if (props.elementInfo.lock) return
  e.stopPropagation()

  props.selectElement(e, props.elementInfo, canMove)
}

// 组件交互区被按下：选中元素显示操作框，但不进入拖动状态
const handleInteract = (e: MouseEvent | TouchEvent) => handleSelectElement(e, false)
</script>

<style lang="scss" scoped>
.editable-element-widget {
  position: absolute;

  &.lock .element-content {
    cursor: default;
  }
}
.rotate-wrapper {
  width: 100%;
  height: 100%;
}
.element-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: move;
}
</style>
