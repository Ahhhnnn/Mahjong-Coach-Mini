// 两端共用按需引擎，不引入 ECharts 全量包。
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
use([LineChart, GridComponent, LegendComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])
export { init, graphic, registerPreprocessor, setPlatformAPI } from 'echarts/core'
export type { EChartsType, EChartsCoreOption } from 'echarts/core'
