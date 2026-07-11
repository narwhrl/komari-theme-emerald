# coss-ui 本地组件使用指南

本项目使用的是 coss-ui 风格的本地 React 组件，而不是直接安装或生成一套外部组件库。组件代码放在 `src/components/ui/`，底层优先复用 `@base-ui/react`，样式使用 Tailwind CSS v4、`class-variance-authority` 和 `cn()` 组合。

官方参考：

- coss-ui: <https://coss.com/ui>
- coss-ui Group: <https://coss.com/ui/docs/components/group>
- coss-ui Toggle Group: <https://coss.com/ui/docs/components/toggle-group>
- Base UI: <https://base-ui.com/>

## 基本约定

- 从 `@/components/ui/*` 导入本地组件，不从外部 UI 包直接导入业务组件。
- 需要交互语义时优先封装 Base UI primitive，例如 `ToggleGroup` 使用 `@base-ui/react/toggle-group` 和 `@base-ui/react/toggle`。
- 样式应收敛在 `src/components/ui/` 的 primitive 内，业务组件只表达组合关系和状态。
- 图标统一使用 `@iconify/react`。需要 Lucide 图标时使用 `lucide:` 前缀，例如 `<Icon icon="lucide:clock" />`；不要新增 `lucide-react` 依赖。
- 组件应提供清晰的可访问性属性，例如 `aria-label`、`aria-pressed`、`role="group"`、`role="separator"`。
- 修改 UI 后运行 `bun run lint` 和 `bun run build`。本仓库没有测试套件，不要新增虚假的测试命令。

## Group

`Group` 用于把多个相关操作组合成一个连续分段控件。它不管理选中状态，只负责布局和样式；每个子按钮仍由业务状态控制。

适合场景：

- 多个独立动作按钮视觉上需要连成一组。
- 多个筛选开关使用 `aria-pressed` 表示开关状态。
- 中间需要 `GroupSeparator` 分隔，但外层共享统一边框、圆角和背景。

当前实现：

- `src/components/ui/group.tsx`
- 示例使用点：`src/components/PingChart.tsx` 的“延迟 / 丢包 / 平滑峰值”

推荐写法：

```tsx
import { Icon } from '@iconify/react'
import { Button } from '@/components/ui/button'
import { Group, GroupSeparator } from '@/components/ui/group'

function ChartDisplayOptions({
  showDelay,
  showLoss,
  cutPeak,
  setShowDelay,
  setShowLoss,
  setCutPeak,
}: {
  showDelay: boolean
  showLoss: boolean
  cutPeak: boolean
  setShowDelay: (updater: (value: boolean) => boolean) => void
  setShowLoss: (updater: (value: boolean) => boolean) => void
  setCutPeak: (updater: (value: boolean) => boolean) => void
}) {
  return (
    <Group aria-label="延迟图表显示选项">
      <Button
        type="button"
        variant="outline"
        aria-pressed={showDelay}
        onClick={() => setShowDelay(value => !value)}
      >
        <Icon icon="lucide:clock" aria-hidden="true" className="size-4" />
        延迟
      </Button>
      <GroupSeparator />
      <Button
        type="button"
        variant="outline"
        aria-pressed={showLoss}
        onClick={() => setShowLoss(value => !value)}
      >
        <Icon icon="lucide:package-x" aria-hidden="true" className="size-4" />
        丢包
      </Button>
      <GroupSeparator />
      <Button
        type="button"
        variant="outline"
        aria-pressed={cutPeak}
        onClick={() => setCutPeak(value => !value)}
      >
        <Icon icon="lucide:chart-spline" aria-hidden="true" className="size-4" />
        平滑峰值
      </Button>
    </Group>
  )
}
```

设计注意：

- `Group` 会覆盖直接子级 `button` 的独立边框、圆角和背景，使它们成为一个连续控件。
- `GroupSeparator` 放在直接子级之间，不要用 margin 模拟分隔线。
- 如果按钮不表示开关状态，省略 `aria-pressed`。

## Toggle Group

`ToggleGroup` 用于一组可切换选项，底层由 Base UI 管理 pressed 状态。当前封装导出：

- `ToggleGroup`
- `ToggleGroupItem`
- `ToggleGroupSeparator`

当前实现：

- `src/components/ui/toggle-group.tsx`
- 示例使用点：`src/views/HomeView.tsx` 的“节点视图切换”

推荐写法：

```tsx
import { Icon } from '@iconify/react'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { DataTooltip } from '@/components/ui/tooltip'

type NodeViewMode = 'card' | 'list'

function isNodeViewMode(value: string | undefined): value is NodeViewMode {
  return value === 'card' || value === 'list'
}

function NodeViewModeToggle({
  value,
  onValueChange,
}: {
  value: NodeViewMode
  onValueChange: (value: NodeViewMode) => void
}) {
  return (
    <ToggleGroup
      aria-label="节点视图切换"
      value={[value]}
      onValueChange={(values) => {
        const nextValue = values.at(0)
        if (isNodeViewMode(nextValue))
          onValueChange(nextValue)
      }}
    >
      <DataTooltip as="span" content="卡片视图" placement="top">
        <ToggleGroupItem aria-label="卡片视图" value="card">
          <Icon icon="tabler:layout-grid" aria-hidden="true" className="size-4" />
        </ToggleGroupItem>
      </DataTooltip>
      <DataTooltip as="span" content="列表视图" placement="top">
        <ToggleGroupItem aria-label="列表视图" value="list">
          <Icon icon="tabler:table" aria-hidden="true" className="size-4" />
        </ToggleGroupItem>
      </DataTooltip>
    </ToggleGroup>
  )
}
```

设计注意：

- Base UI 的 `ToggleGroup` 使用数组表示选中值，即使是单选视觉控件也传 `value={[value]}`。
- `onValueChange` 也返回数组。若业务状态必须始终有效，应过滤空数组或未知值，不要直接写入 store。
- `ToggleGroupItem` 必须提供稳定的 `value`。
- 图标按钮需要 `aria-label`，否则只有图标时可访问名称不清晰。
- 使用官方 tooltip 样式时保留默认 variant，不添加外框或 `ToggleGroupSeparator`。
- 需要连续 outline 分段控件时，再使用 `variant="outline"` 与 `ToggleGroupSeparator`。

## 新增本地 coss-ui 风格组件

新增 primitive 时按以下顺序判断：

1. 是否已有 `src/components/ui/` 组件可以组合完成。
2. 是否有合适的 Base UI primitive 可以封装。
3. 是否确实需要新的本地组件，而不是业务组件里的局部样式。

实现要求：

- 文件放在 `src/components/ui/`。
- 需要 hooks、Base UI 或浏览器行为时加 `'use client'`。
- 使用 `ComponentProps` 继承底层元素或 Base UI 组件的 props。
- 复杂 variant 用 `cva`；简单组合可以直接用 `cn()`。
- 暴露 `data-slot`，方便调试、样式定位和浏览器验证。
- separator 组件使用 `role="separator"` 和 `aria-orientation`。

不建议：

- 在业务组件里复制长串 Tailwind 类来模拟一个可复用 primitive。
- 为单个控件引入新的 UI 库、CSS 文件或图标依赖。
- 把 `@base-ui/react` 直接散落到业务视图里，除非是一次性且没有复用价值的底层行为。
