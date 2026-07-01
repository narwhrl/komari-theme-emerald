/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Register ECharts modules once at app startup.
 * Equivalent to the Vue version — uses tree-shaken modules from `echarts/core`.
 *
 * `use` is the ECharts module registration API, not React's `use` hook.
 */
import { LineChart, MapChart } from "echarts/charts";
import {
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([
  LineChart,
  MapChart,
  GridComponent,
  GeoComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  DataZoomComponent,
  CanvasRenderer,
]);