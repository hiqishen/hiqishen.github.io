import { marketScanIndex, marketScanFor, marketReportLabels, marketReportMeanings } from './market-scans.js';

export function createScanReader({ fetcher = fetch } = {}) {
  let snapshot;
  function loadScanIndex() {
    if (!snapshot) {
      snapshot = fetcher(new URL('./market-scans.json', import.meta.url), { credentials: 'omit', signal: AbortSignal.timeout(10000) })
        .then(async response => {
          if (!response.ok) throw new Error('扫描摘要暂不可用');
          return marketScanIndex(await response.json());
        }).catch(error => { snapshot = undefined; throw error; });
    }
    return snapshot;
  }
  async function getScanStatuses(plugins) {
    const index = await loadScanIndex();
    const statuses = new Map();
    for (const plugin of plugins) {
      const report = marketScanFor(plugin, index);
      if (report) statuses.set(plugin.id, report.status);
    }
    return statuses;
  }
  async function getScan(plugin) {
    if (plugin.path) return { status: 'MISSING', label: '暂无组件报告', detail: '此项是仓库里的独立组件。当前摘要按仓库根项目提供报告。' };
    try {
      const record = marketScanFor(plugin, await loadScanIndex());
      if (!record) return { status: 'MISSING', label: '暂无匹配报告', detail: '当前扫描摘要里没有与此仓库和包名匹配的报告。' };
      const revision = record.version ? 'v' + record.version.replace(/^v/i, '') : record.sha.slice(0, 8);
      return {
        status: record.status, label: marketReportLabels.get(record.status) + ' · ' + revision,
        detail: 'DSH Plugin Market 静态扫描，提交 ' + record.sha.slice(0, 8) + '。' + marketReportMeanings[record.status] + ' 报告仅对应标注的版本或提交。',
        url: 'https://dsh-plugin.market/plugin/' + record.repo,
      };
    } catch { return { status: 'UNAVAILABLE', label: '扫描摘要暂不可用', detail: '当前无法读取有效的扫描摘要，请稍后重试；不能据此判断项目安全。' }; }
  }
  return { getScan, getScanStatuses };
}

export const { getScan, getScanStatuses } = createScanReader();
