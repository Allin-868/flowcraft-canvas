// 阶段 0.5 — 执行接口兼容层
// 当前委托旧 runNode(node) / generateOpenAIImage(node)。
// 阶段 3 将在此接口后替换实现为任务执行引擎（状态机 / 调度 / 对账 / 取消 / 幂等）。
export const Runner = {
  _mode: 'legacy-runNode',

  // 运行单个节点：委托旧 runNode(node)
  runNode(node) {
    if (typeof runNode === 'function') return runNode(node);
    return null;
  },

  // 图像生成：委托旧 generateOpenAIImage(node)
  generateImage(node) {
    if (typeof generateOpenAIImage === 'function') return generateOpenAIImage(node);
    return null;
  },

  getMode() {
    return this._mode;
  },
};
