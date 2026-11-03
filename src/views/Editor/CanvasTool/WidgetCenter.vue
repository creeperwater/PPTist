<template>
  <div class="widget-center">
    <div class="header">
      <div class="title">组件中心</div>
    </div>
    <div class="widget-list">
      <div
        class="widget-card"
        v-for="widget in WIDGETS"
        :key="widget.type"
        @click="emit('select', widget.type)"
      >
        <div class="preview">
          <div
            class="preview-box"
            :style="{ width: PREVIEW_WIDTH + 'px', height: PREVIEW_HEIGHT + 'px' }"
          >
            <component
              :is="widget.component"
              :data="widget.defaultData()"
              :width="PREVIEW_WIDTH"
              :height="PREVIEW_HEIGHT"
            />
          </div>
        </div>
        <div class="info">
          <div class="name">{{ widget.name }}</div>
          <div class="desc">{{ widget.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { WidgetType } from '@/types/slides'
import { WIDGETS } from '@/widgets'

// 预览区渲染尺寸 = 卡片预览区实际内容尺寸（270-2×10 宽、140-2×10 高），
// 传给组件的尺寸与真实渲染尺寸一致，组件内部布局计算才不会失真
const PREVIEW_WIDTH = 250
const PREVIEW_HEIGHT = 120

const emit = defineEmits<{
  (event: 'select', payload: WidgetType): void
}>()
</script>

<style lang="scss" scoped>
.widget-center {
  width: 840px;
}
.header {
  margin-bottom: 15px;
  padding-right: 40px;

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }
}
.widget-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}
.widget-card {
  width: 270px;
  border: 1px solid $borderColor;
  border-radius: $borderRadius;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow .2s, border-color .2s;

  &:hover {
    border-color: $themeColor;
    box-shadow: $boxShadow;
  }

  .preview {
    height: 140px;
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f7f7f7;

    .preview-box {
      overflow: hidden;
    }
  }

  .info {
    padding: 10px 15px;
    background-color: #fff;

    .name {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    .desc {
      font-size: 12px;
      color: #999;
    }
  }
}
</style>
