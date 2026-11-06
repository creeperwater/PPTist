<template>
  <div 
    class="base-element"
    :class="`base-element-${elementInfo.id}`"
    :style="{
      zIndex: elementIndex,
    }"
  >
    <component
      :is="currentElementComponent"
      :elementInfo="elementInfo"
      :interactive="interactive"
      target="thumbnail"
    ></component>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { ElementTypes, type PPTElement } from '@/types/slides'

import BaseImageElement from '@/views/components/element/ImageElement/BaseImageElement.vue'
import BaseTextElement from '@/views/components/element/TextElement/BaseTextElement.vue'
import BaseShapeElement from '@/views/components/element/ShapeElement/BaseShapeElement.vue'
import BaseLineElement from '@/views/components/element/LineElement/BaseLineElement.vue'
import BaseChartElement from '@/views/components/element/ChartElement/BaseChartElement.vue'
import BaseTableElement from '@/views/components/element/TableElement/BaseTableElement.vue'
import BaseLatexElement from '@/views/components/element/LatexElement/BaseLatexElement.vue'
import BaseVideoElement from '@/views/components/element/VideoElement/BaseVideoElement.vue'
import BaseAudioElement from '@/views/components/element/AudioElement/BaseAudioElement.vue'
import BaseWidgetElement from '@/views/components/element/WidgetElement/BaseWidgetElement.vue'

const props = withDefaults(defineProps<{
  elementInfo: PPTElement
  elementIndex: number
  // 是否可交互（默认不可交互；移动端播放模式等场景传 true，组件按钮可点击）
  interactive?: boolean
}>(), {
  interactive: false,
})

const currentElementComponent = computed<unknown>(() => {
  const elementTypeMap = {
    [ElementTypes.IMAGE]: BaseImageElement,
    [ElementTypes.TEXT]: BaseTextElement,
    [ElementTypes.SHAPE]: BaseShapeElement,
    [ElementTypes.LINE]: BaseLineElement,
    [ElementTypes.CHART]: BaseChartElement,
    [ElementTypes.TABLE]: BaseTableElement,
    [ElementTypes.LATEX]: BaseLatexElement,
    [ElementTypes.VIDEO]: BaseVideoElement,
    [ElementTypes.AUDIO]: BaseAudioElement,
    [ElementTypes.WIDGET]: BaseWidgetElement,
  }
  return elementTypeMap[props.elementInfo.type] || null
})
</script>