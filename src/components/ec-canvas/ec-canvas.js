import WxCanvas from './wx-canvas';
// Adapted from ecomfe/echarts-for-weixin (BSD-3-Clause); see LICENSE.
import * as echarts from '../chart-engine';

const MAX_ATTEMPTS = 30;
const RETRY_DELAY = 150;
let preprocessorRegistered = false;
function atLeast(version, target) {
  const a = version.split('.').map(Number), b = target.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}
function sdkVersion() {
  return (wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync()).SDKVersion;
}
function pixelRatio() {
  const ratio = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

Component({
  properties: {
    canvasId: { type: String, value: 'ec-canvas' },
    ec: { type: Object },
    forceUseOldCanvas: { type: Boolean, value: false }
  },
  data: { isUseNewCanvas: false },
  ready() {
    this._ready = true;
    if (!preprocessorRegistered) {
      echarts.registerPreprocessor(option => {
        const series = option && option.series;
        (Array.isArray(series) ? series : series ? [series] : []).forEach(item => { item.progressive = 0; });
      });
      preprocessorRegistered = true;
    }
    if (this._initRequested || (this.data.ec && !this.data.ec.lazyLoad)) this.init();
  },
  detached() {
    this.disposed = true;
    this.cancelInit();
    if (this.chart && !this.chart.isDisposed()) this.chart.dispose();
    this.chart = null;
    this.canvasNode = null;
    this._initCallback = null;
    this._errorCallback = null;
  },
  pageLifetimes: {
    hide() { this.cancelInit(); },
    show() { this.resizeChart(); }
  },
  methods: {
    cancelInit() {
      clearTimeout(this._initTimer);
      this._initTimer = null;
      this._initializing = false;
      this._generation = (this._generation || 0) + 1;
    },
    resizeChart() {
      if (this.disposed) return;
      if (!this.chart || this.chart.isDisposed()) {
        if (this._initRequested) this.init();
        return;
      }
      wx.createSelectorQuery().in(this).select('.ec-canvas').boundingClientRect(rect => {
        if (!this.disposed && rect && rect.width > 0 && rect.height > 0 && this.chart && !this.chart.isDisposed()) {
          this.chart.resize({ width: rect.width, height: rect.height });
        }
      }).exec();
    },
    // 支持 React 在 ready 之前发起请求；函数只通过实例方法传递，不放进 setData。
    init(callback, onError) {
      if (this.disposed) return;
      if (typeof callback === 'function') this._initCallback = callback;
      if (typeof onError === 'function') this._errorCallback = onError;
      this._initRequested = true;
      if (!this._ready || this._initializing || (this.chart && !this.chart.isDisposed())) return;
      this.cancelInit();
      this._initializing = true;
      this._attempts = 0;
      const generation = this._generation;
      try {
        const version = sdkVersion();
        if (!atLeast(version, '1.9.91')) throw new Error('微信版本过低，请更新微信后重试');
        const isUseNewCanvas = atLeast(version, '2.9.0') && !this.data.forceUseOldCanvas;
        // 真机 setData 是异步的。必须等 wx:if 切换到 Canvas 2D 后才能取得 node。
        this.setData({ isUseNewCanvas }, () => {
          if (!this.disposed && generation === this._generation) this.queryCanvas(generation);
        });
      } catch (error) { this.failInit(error, generation); }
    },
    failInit(error, generation) {
      if (this.disposed || generation !== this._generation) return;
      this.cancelInit();
      console.warn('[ec-canvas] initialization failed', this.data.canvasId, error);
      if (this._errorCallback) this._errorCallback(error);
    },
    retryInit(generation, error) {
      if (this.disposed || generation !== this._generation) return;
      if (this._attempts >= MAX_ATTEMPTS) {
        this.failInit(error || new Error('Canvas 节点或尺寸尚未就绪'), generation);
        return;
      }
      this._initTimer = setTimeout(() => this.queryCanvas(generation), RETRY_DELAY);
    },
    queryCanvas(generation) {
      if (this.disposed || generation !== this._generation) return;
      this._attempts++;
      try {
        const query = wx.createSelectorQuery().in(this).select('.ec-canvas');
        if (this.data.isUseNewCanvas) {
          query.fields({ node: true, size: true }).exec(result => {
            if (this.disposed || generation !== this._generation) return;
            const info = result && result[0];
            if (!info || !info.node || !(info.width > 0) || !(info.height > 0)) {
              this.retryInit(generation);
              return;
            }
            try {
              const node = info.node;
              const context = node.getContext('2d');
              if (!context) { this.retryInit(generation); return; }
              this.canvasNode = node;
              const canvas = new WxCanvas(context, this.data.canvasId, true, node);
              echarts.setPlatformAPI({
                createCanvas: () => canvas,
                loadImage: (src, onload, onerror) => {
                  const image = node.createImage();
                  image.onload = onload;
                  image.onerror = onerror;
                  image.src = src;
                  return image;
                }
              });
              this.finishInit(canvas, info.width, info.height, pixelRatio(), generation);
            } catch (error) { this.failInit(error, generation); }
          });
        } else {
          query.boundingClientRect(rect => {
            if (this.disposed || generation !== this._generation) return;
            if (!rect || !(rect.width > 0) || !(rect.height > 0)) { this.retryInit(generation); return; }
            try {
              this.ctx = wx.createCanvasContext(this.data.canvasId, this);
              const canvas = new WxCanvas(this.ctx, this.data.canvasId, false);
              echarts.setPlatformAPI({ createCanvas: () => canvas });
              this.finishInit(canvas, rect.width, rect.height, 1, generation);
            } catch (error) { this.failInit(error, generation); }
          }).exec();
        }
      } catch (error) { this.retryInit(generation, error); }
    },
    finishInit(canvas, width, height, dpr, generation) {
      const callback = this._initCallback || (this.data.ec && this.data.ec.onInit);
      if (typeof callback !== 'function') throw new Error('缺少图表初始化回调');
      const chart = callback(canvas, width, height, dpr);
      if (this.disposed || generation !== this._generation) {
        if (chart && !chart.isDisposed()) chart.dispose();
        return;
      }
      this.chart = chart;
      this._initializing = false;
      clearTimeout(this._initTimer);
      this._initTimer = null;
    },
    canvasToTempFilePath(opt) {
      if (this.data.isUseNewCanvas) {
        if (this.canvasNode) wx.canvasToTempFilePath({ ...opt, canvas: this.canvasNode });
      } else if (this.ctx) {
        this.ctx.draw(true, () => wx.canvasToTempFilePath({ ...opt, canvasId: this.data.canvasId }, this));
      }
    },
    touchStart(e) {
      if (this.chart && e.touches.length > 0) {
        var touch = e.touches[0];
        var handler = this.chart.getZr().handler;
        handler.dispatch('mousedown', {
          zrX: touch.x,
          zrY: touch.y,
          preventDefault: () => {},
          stopImmediatePropagation: () => {},
          stopPropagation: () => {}
        });
        handler.dispatch('mousemove', {
          zrX: touch.x,
          zrY: touch.y,
          preventDefault: () => {},
          stopImmediatePropagation: () => {},
          stopPropagation: () => {}
        });
        handler.processGesture(wrapTouch(e), 'start');
      }
    },

    touchMove(e) {
      if (this.chart && e.touches.length > 0) {
        var touch = e.touches[0];
        var handler = this.chart.getZr().handler;
        handler.dispatch('mousemove', {
          zrX: touch.x,
          zrY: touch.y,
          preventDefault: () => {},
          stopImmediatePropagation: () => {},
          stopPropagation: () => {}
        });
        handler.processGesture(wrapTouch(e), 'change');
      }
    },

    touchEnd(e) {
      if (this.chart) {
        const touch = e.changedTouches ? e.changedTouches[0] : {};
        var handler = this.chart.getZr().handler;
        handler.dispatch('mouseup', {
          zrX: touch.x,
          zrY: touch.y,
          preventDefault: () => {},
          stopImmediatePropagation: () => {},
          stopPropagation: () => {}
        });
        handler.dispatch('click', {
          zrX: touch.x,
          zrY: touch.y,
          preventDefault: () => {},
          stopImmediatePropagation: () => {},
          stopPropagation: () => {}
        });
        handler.processGesture(wrapTouch(e), 'end');
      }
    }
  }
});

function wrapTouch(event) {
  for (let i = 0; i < event.touches.length; ++i) {
    const touch = event.touches[i];
    touch.offsetX = touch.x;
    touch.offsetY = touch.y;
  }
  return event;
}
