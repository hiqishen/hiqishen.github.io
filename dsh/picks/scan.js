let snapshot;
function loadScanIndex() {
  if (!snapshot) {
    snapshot = fetch(new URL("../market-scans.json", import.meta.url), { signal: AbortSignal.timeout(10000) })
      .then(async response => {
        if (!response.ok) throw new Error("读取扫描摘要失败");
        return marketScanIndex(await response.json());
      })
      .catch(error => {
        snapshot = undefined;
        throw error;
      });
  }
  return snapshot;
}

export async function getScan(plugin) {
  if (plugin.path) return { label: "暂无组件报告", detail: "此项是仓库里的独立组件。当前摘要按仓库根项目提供报告。" };
  try {
    const index = await loadScanIndex();
    const record = marketScanFor({ repo: plugin.repo, installRecord: { npm: plugin.packageName } }, index);
    if (!record) return { label: "暂无匹配报告", detail: "当前扫描摘要里没有与此仓库和包名匹配的报告。" };
    const revision = record.version ? "v" + record.version.replace(/^v/i, "") : record.sha.slice(0, 8);
    return {
      label: marketReportLabels.get(record.status) + " · " + revision,
      detail: "DSH Plugin Market 静态扫描，提交 " + record.sha.slice(0, 8) + "。" + marketReportMeanings[record.status] + " 报告仅对应标注的版本或提交。",
      url: "https://dsh-plugin.market/plugin/" + record.repo,
    };
  } catch {
    return { label: "扫描摘要暂不可用", detail: "请稍后重新打开详情查看报告。当前无法确认扫描状态。" };
  }
}
