const marketReportLabels = new Map([
  ['PASSED', '未见高风险'],
  ['REVIEW', '需复核'],
  ['FAILED', '未通过'],
  ['UNKNOWN', '未能判定'],
]);
const marketReportMeanings = {
  PASSED: '静态检查未发现需要复核的安全信号，仍可能有低级别提示。',
  REVIEW: '静态规则命中了需要人工复核的行为，例如安装脚本或进程调用。具体命中项见原报告。',
  FAILED: '这次扫描未通过安全检查。可打开原报告，核对触发规则的代码和严重程度。',
  UNKNOWN: '第三方已扫描这次提交，但现有信息不足以判定安全状态。',
};
const marketRepoPattern = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/;

function marketScanIndex(snapshot) {
  if (snapshot?.source !== 'DSH Plugin Market' || !Array.isArray(snapshot.rows)) throw new Error('报告摘要格式异常');
  const reports = new Map();
  for (const row of snapshot.rows) {
    if (!Array.isArray(row)) continue;
    const [repo, status, version, sha, packageName] = row;
    if (typeof repo !== 'string' || !marketRepoPattern.test(repo) || ['.', '..'].includes(repo.split('/')[1])) continue;
    if (!marketReportLabels.has(status) || typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) continue;
    if (typeof version !== 'string' || typeof packageName !== 'string') continue;
    const key = repo.toLowerCase();
    // 一个仓库出现两份不同记录时，不选择其中任意一份作为当前报告。
    reports.set(key, reports.has(key) ? null : {repo,status,version,sha,packageName});
  }
  if (snapshot.rows.length && !reports.size) throw new Error('报告摘要没有可读取的记录');
  return reports;
}

function marketScanEligible(project) {
  return !project.componentPath && typeof project.repo === 'string' && marketRepoPattern.test(project.repo)
    && !/\/tree\/[^/]+\/.+/.test(project.url || '');
}

function marketScanFor(project, index) {
  if (!marketScanEligible(project)) return null;
  const report = index?.get(project.repo.toLowerCase());
  if (!report) return null;
  const declared = project.installRecord?.npm || project.awesomeInstallSpec;
  if (declared && typeof declared !== 'string') return null;
  if (declared && report.packageName && !declared.startsWith('github:')) {
    const versionAt = declared.indexOf('@', 1);
    const name = versionAt < 0 ? declared : declared.slice(0, versionAt);
    if (name !== report.packageName) return null;
  }
  return report;
}

function marketScanTooltip(id, title, meaning, sha = '') {
  const commit = sha ? '<br>扫描提交 · ' + sha.slice(0, 8) : '';
  return '<span class="market-scan-tooltip" id="' + id + '" role="tooltip"><span class="scan-tip-body">'
    + '<strong>' + title + '</strong><span>' + meaning + '</span>'
    + '<small>来源 · DSH Plugin Market' + commit + '</small></span></span>';
}

let marketTipSequence = 0;
function marketScanSlot(project, index) {
  if (!index) return '<span class="market-scan" hidden></span>';
  const report = marketScanFor(project, index);
  const tipId = 'market-tip-' + (++marketTipSequence);
  if (!report) {
    let meaning = '当前扫描摘要中没有与这个项目匹配的报告。';
    if (project.componentPath || /\/tree\/[^/]+\/.+/.test(project.url || '')) {
      meaning = '扫描方按仓库根项目出具报告，当前摘要中没有单独对应这个子组件的报告。';
    } else if (typeof project.repo === 'string' && index.has(project.repo.toLowerCase())) {
      meaning = '当前摘要中有同仓库的记录，但无法确认报告对应这个项目。';
    }
    return '<span class="market-scan"><span class="scan-missing" tabindex="0" aria-describedby="' + tipId + '">未扫描</span>'
      + marketScanTooltip(tipId, '未扫描', meaning) + '</span>';
  }
  const revision = report.version ? report.version.replace(/^v?/i, 'v') : report.sha.slice(0, 8);
  const summary = marketReportLabels.get(report.status) + ' · ' + revision;
  const href = 'https://dsh-plugin.market/plugin/' + report.repo;
  return '<span class="market-scan"><a href="' + href
    + '" target="_blank" rel="noopener noreferrer" data-status="' + report.status
    + '" aria-label="' + esc('DSH Plugin Market 扫描报告：' + summary) + '" aria-describedby="' + tipId
    + '">' + esc(summary) + ' ↗</a>'
    + marketScanTooltip(tipId, marketReportLabels.get(report.status) + ' · ' + report.status, marketReportMeanings[report.status], report.sha)
    + '</span>';
}

function bindMarketScanTooltips(cards) {
  function place(slot) {
    const tip = slot.querySelector('.market-scan-tooltip');
    if (!tip) return;
    const anchor = slot.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(anchor.left, document.documentElement.clientWidth - tip.offsetWidth - margin));
    tip.style.left = (left - anchor.left) + 'px';
    slot.classList.toggle('tip-below', anchor.top < tip.offsetHeight + margin);
  }
  function enter(event) {
    const slot = event.target.closest('.market-scan');
    if (!slot || slot.contains(event.relatedTarget)) return;
    slot.classList.remove('tip-dismissed');
    place(slot);
  }
  cards.addEventListener('pointerover', enter);
  cards.addEventListener('focusin', enter);
  const activeSlots = () => cards.querySelectorAll('.market-scan:hover, .market-scan:focus-within');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') activeSlots().forEach(slot => slot.classList.add('tip-dismissed'));
  });
  const reposition = () => activeSlots().forEach(place);
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, {passive:true});
}
