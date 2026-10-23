# 微信 ECharts 适配

源码来源：https://github.com/ecomfe/echarts-for-weixin/tree/master/ec-canvas

保留 BSD-3-Clause LICENSE。原全量 echarts 引用改为项目按需 chart-engine，增加卸载销毁和异步节点保护。初始化等待原生 ready 和 setData 渲染回调；空节点、零尺寸与临时查询异常最多重试 30 次，失败回传给 React 展示重试入口，页面恢复时可重新初始化。预处理器每个模块只注册一次。使用 Canvas 2D 与 richText Tooltip。H5 走独立实现，不加载原生组件。
