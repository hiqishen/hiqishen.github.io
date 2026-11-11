export const marketReportLabels = new Map([
  ['PASSED', '未见高风险'], ['REVIEW', '需复核'], ['FAILED', '未通过'], ['UNKNOWN', '未能判定'],
]);
export const marketReportMeanings = {
  PASSED: '静态检查未发现需要复核的安全信号，仍可能有低级别提示。',
  REVIEW: '静态规则命中了需要人工复核的行为，具体命中项见原报告。',
  FAILED: '这次扫描未通过安全检查，请核对原报告中的规则和代码。',
  UNKNOWN: '第三方已扫描这次提交，但现有信息不足以判定安全状态。',
};
const repoPattern = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/;

export function marketScanIndex(snapshot) {
  if (snapshot?.source !== 'DSH Plugin Market' || snapshot.unavailable || !Array.isArray(snapshot.rows) ||
      typeof snapshot.fetchedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.fetchedAt))) throw new Error('扫描摘要暂不可用');
  const reports = new Map();
  for (const row of snapshot.rows) {
    if (!Array.isArray(row)) throw new Error('扫描摘要格式异常');
    const [repo, status, version, sha, packageName] = row;
    if (typeof repo !== 'string' || !repoPattern.test(repo) || ['.', '..'].includes(repo.split('/')[1]) ||
        !marketReportLabels.has(status) || typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha) ||
        typeof version !== 'string' || typeof packageName !== 'string') throw new Error('扫描摘要格式异常');
    const key = repo.toLowerCase();
    reports.set(key, reports.has(key) ? null : { repo, status, version, sha, packageName });
  }
  if (!reports.size) throw new Error('扫描摘要没有可匹配的报告');
  return reports;
}

export function marketScanFor(plugin, index) {
  if (plugin.path || !repoPattern.test(plugin.repo)) return null;
  const report = index.get(plugin.repo.toLowerCase());
  if (!report) return null;
  const declared = plugin.packageName;
  // 没有双方一致的包名时，不把根仓库报告推断为某个插件的报告。
  if (!declared || !report.packageName || declared !== report.packageName) return null;
  return report;
}
