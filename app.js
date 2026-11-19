/* ==========================================================================
   CodeVault · 个人代码保存站
   纯前端应用逻辑：JSON(localStorage) 存储、CRUD、搜索、筛选、高亮、导入导出
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 常量
  var STORAGE_KEY = 'codevault_data_v1';
  var TYPE_LABELS = {
    template: '模板代码',
    problem: '题目代码',
    clipboard: '云剪贴板'
  };
  var LANG_OPTIONS = [
    'cpp', 'c', 'python', 'java', 'javascript', 'typescript', 'go', 'rust',
    'sql', 'html', 'css', 'bash', 'json', 'markdown', 'plaintext'
  ];

  // 高亮关键字与内置类型（覆盖常见语言）
  var KEYWORDS = {};
  var commonKw = ('auto break case catch char class const const_cast constexpr continue default delete do double ' +
    'dynamic_cast else enum explicit export extern false final float for friend goto if implicit import inline int ' +
    'long mutable namespace new noexcept nullptr operator override private protected public register reinterpret_cast ' +
    'return short signed sizeof static static_assert static_cast struct switch template this throw true try typedef ' +
    'typeid typename union unsigned using virtual void volatile while ' +
    'and or not xor not_eq ' +
    'def lambda pass raise yield assert async await from global import nonlocal in is del elif except finally with as ' +
    'function var let null undefined typeof instanceof of extends super implements interface package extends ' +
    'func defer range map chan go package select ' +
    'fn mut impl pub crate use mod trait where match loop ' +
    'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE DROP ALTER JOIN ON GROUP BY ORDER LIMIT').split(/\s+/);
  var builtinTypes = ('string vector map set pair queue stack deque list array unordered_map unordered_set ' +
    'shared_ptr unique_ptr bool byte int8 int16 int32 int64 uint float32 float64 str list dict tuple set ' +
    'String Array Object Number Boolean Promise void never unknown any').split(/\s+/);

  LANG_OPTIONS.forEach(function (lang) { KEYWORDS[lang] = commonKw; });
  ['cpp', 'c', 'python', 'java', 'javascript', 'typescript', 'go', 'rust', 'sql', 'bash'].forEach(function (lang) {
    KEYWORDS[lang] = commonKw;
  });

  var HASH_COMMENT_LANGS = ['python', 'py', 'bash', 'sh', 'shell', 'ruby', 'yaml', 'yml', 'toml', 'ini', 'r', 'perl'];

  // ---------------------------------------------------------------- DOM
  var $ = function (id) { return document.getElementById(id); };
  var dom = {
    searchInput: $('searchInput'),
    sidebar: $('sidebar'),
    sidebarToggle: $('sidebarToggle'),
    sidebarBackdrop: $('sidebarBackdrop'),
    moreBtn: $('moreBtn'),
    moreMenu: $('moreMenu'),
    newBtn: $('newBtn'),
    brandHome: $('brandHome'),
    pageTitle: $('pageTitle'),
    pageDesc: $('pageDesc'),
    quickPaste: $('quickPaste'),
    quickPasteInput: $('quickPasteInput'),
    quickPasteTitle: $('quickPasteTitle'),
    quickPasteSave: $('quickPasteSave'),
    langChips: $('langChips'),
    resultInfo: $('resultInfo'),
    cardList: $('cardList'),
    emptyState: $('emptyState'),
    emptyTitle: $('emptyTitle'),
    emptyDesc: $('emptyDesc'),
    emptyActionBtn: $('emptyActionBtn'),
    tagList: $('tagList'),
    countAll: $('countAll'),
    countTemplate: $('countTemplate'),
    countProblem: $('countProblem'),
    countClipboard: $('countClipboard'),
    storageInfo: $('storageInfo'),
    editorModal: $('editorModal'),
    editorTitle: $('editorTitle'),
    editorForm: $('editorForm'),
    editorSubmit: $('editorSubmit'),
    viewModal: $('viewModal'),
    viewTitle: $('viewTitle'),
    viewBody: $('viewBody'),
    viewCopyBtn: $('viewCopyBtn'),
    viewEditBtn: $('viewEditBtn'),
    confirmModal: $('confirmModal'),
    confirmTitle: $('confirmTitle'),
    confirmMessage: $('confirmMessage'),
    confirmOk: $('confirmOk'),
    importFile: $('importFile'),
    toast: $('toast')
  };

  // ---------------------------------------------------------------- 状态
  var state = {
    data: { items: [] },
    category: 'all',
    search: '',
    lang: '',
    tag: '',
    editingId: null,
    editingType: 'template',
    viewingId: null,
    confirmAction: null
  };

  var memoryFallback = null; // localStorage 不可用时的内存回退

  // ---------------------------------------------------------------- 工具
  function uid() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTitle(item) {
    if (item.type === 'template') return item.name || '未命名模板';
    if (item.type === 'problem') return item.title || '未命名题目';
    return item.title || '未命名片段';
  }

  function getBody(item) {
    return item.type === 'clipboard' ? (item.content || '') : (item.code || '');
  }

  function getLang(item) {
    return item.language || 'plaintext';
  }

  function getDesc(item) {
    if (item.type === 'template') return item.description || '';
    if (item.type === 'problem') return item.notes || '';
    return '';
  }

  function formatTime(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    var min = 60 * 1000, hour = 60 * min, day = 24 * hour;
    if (diff < min) return '刚刚';
    if (diff < hour) return Math.floor(diff / min) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function showToast(message, type) {
    dom.toast.textContent = message;
    dom.toast.className = 'toast' + (type ? ' ' + type : '');
    dom.toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () { dom.toast.hidden = true; }, 2600);
  }

  // ---------------------------------------------------------------- 存储
  function loadData() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = memoryFallback;
    }
    if (!raw) return { items: [] };
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
      return parsed;
    } catch (e) {
      return { items: [] };
    }
  }

  function saveData() {
    var raw = JSON.stringify(state.data);
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch (e) {
      memoryFallback = raw;
      showToast('浏览器存储不可用，数据仅保存在当前页面', 'error');
    }
  }

  // ---------------------------------------------------------------- 代码高亮
  function buildTokenRegex(lang) {
    var comment = HASH_COMMENT_LANGS.indexOf(lang) >= 0
      ? '#[^\\n]*'
      : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
    return new RegExp(
      '(' + comment + ')' +                                             // 1 注释
      '|(#[^\\n]*)' +                                                    // 2 预处理
      '|("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)' + // 3 字符串
      '|\\b(\\d+(?:\\.\\d+)?[a-zA-Z]?)\\b' +                             // 4 数字
      '|\\b([A-Za-z_$][\\w$]*)\\b' +                                     // 5 标识符
      '|([+\\-*/%=<>!&|^~?:]+)',                                         // 6 操作符
      'g'
    );
  }

  function highlight(code, lang) {
    var safeCode = escapeHtml(code);
    var regex = buildTokenRegex(lang);
    var keywords = KEYWORDS[lang] || commonKw;
    var out = '';
    var last = 0;
    var m;
    while ((m = regex.exec(safeCode)) !== null) {
      out += safeCode.slice(last, m.index);
      var text = m[0];
      if (m[1]) {
        out += '<span class="tok-com">' + text + '</span>';
      } else if (m[2]) {
        out += '<span class="tok-type">' + text + '</span>';
      } else if (m[3]) {
        out += '<span class="tok-str">' + text + '</span>';
      } else if (m[4]) {
        out += '<span class="tok-num">' + text + '</span>';
      } else if (m[5]) {
        if (keywords.indexOf(text) >= 0) {
          out += '<span class="tok-kw">' + text + '</span>';
        } else if (builtinTypes.indexOf(text) >= 0) {
          out += '<span class="tok-type">' + text + '</span>';
        } else if (safeCode.charAt(regex.lastIndex) === '(') {
          out += '<span class="tok-fn">' + text + '</span>';
        } else {
          out += text;
        }
      } else if (m[6]) {
        out += '<span class="tok-op">' + text + '</span>';
      } else {
        out += text;
      }
      last = regex.lastIndex;
    }
    out += safeCode.slice(last);
    return out;
  }

  // ---------------------------------------------------------------- 筛选
  function filteredItems() {
    var search = state.search.trim().toLowerCase();
    return state.data.items.filter(function (item) {
      if (state.category !== 'all' && item.type !== state.category) return false;
      if (state.lang && getLang(item) !== state.lang) return false;
      if (state.tag && (item.tags || []).indexOf(state.tag) < 0) return false;
      if (search) {
        var haystack = [
          getTitle(item), getDesc(item), getBody(item), getLang(item),
          (item.source || ''), (item.tags || []).join(' ')
        ].join('\n').toLowerCase();
        if (haystack.indexOf(search) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  // ---------------------------------------------------------------- 渲染
  function render() {
    updateCounts();
    renderTags();
    renderLangChips();
    renderHeading();
    renderQuickPaste();
    renderCards();
  }

  function updateCounts() {
    var items = state.data.items;
    dom.countAll.textContent = items.length;
    dom.countTemplate.textContent = items.filter(function (i) { return i.type === 'template'; }).length;
    dom.countProblem.textContent = items.filter(function (i) { return i.type === 'problem'; }).length;
    dom.countClipboard.textContent = items.filter(function (i) { return i.type === 'clipboard'; }).length;
    dom.storageInfo.textContent = '本地存储 · ' + items.length + ' 条';
  }

  function renderHeading() {
    var map = {
      all: ['全部代码', '集中管理你的模板、题目与临时文本片段'],
      template: ['模板代码', '常用算法与代码片段模板，随取随用'],
      problem: ['题目代码', '题解代码、来源与思路备注一站式记录'],
      clipboard: ['其他 / 云剪贴板', '临时文本快速粘贴、复制与管理']
    };
    var info = map[state.category] || map.all;
    dom.pageTitle.textContent = info[0];
    dom.pageDesc.textContent = info[1];
  }

  function renderQuickPaste() {
    dom.quickPaste.hidden = state.category !== 'clipboard';
  }

  function renderTags() {
    var counter = {};
    state.data.items.forEach(function (item) {
      (item.tags || []).forEach(function (tag) {
        counter[tag] = (counter[tag] || 0) + 1;
      });
    });
    var tags = Object.keys(counter).sort(function (a, b) { return counter[b] - counter[a]; });
    if (!tags.length) {
      dom.tagList.innerHTML = '<span style="font-size:12px;color:var(--text-faint);padding:0 8px;">暂无标签</span>';
      return;
    }
    var html = tags.map(function (tag) {
      return '<button class="tag-filter' + (state.tag === tag ? ' active' : '') +
        '" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</button>';
    }).join('');
    dom.tagList.innerHTML = html;
  }

  function renderLangChips() {
    var scope = state.data.items.filter(function (item) {
      return state.category === 'all' || item.type === state.category;
    });
    var langs = {};
    scope.forEach(function (item) { langs[getLang(item)] = true; });
    var list = Object.keys(langs).sort();
    if (state.lang && list.indexOf(state.lang) < 0) state.lang = '';

    var html = '<button class="chip' + (state.lang === '' ? ' active' : '') + '" data-lang="">全部语言</button>';
    html += list.map(function (lang) {
      return '<button class="chip' + (state.lang === lang ? ' active' : '') +
        '" data-lang="' + escapeHtml(lang) + '">' + escapeHtml(lang) + '</button>';
    }).join('');
    dom.langChips.innerHTML = html;
  }

  function renderCards() {
    var items = filteredItems();
    var searching = !!(state.search.trim() || state.tag || state.lang);
    dom.resultInfo.textContent = '共 ' + items.length + ' 条' +
      (searching ? '结果' : '代码') +
      (state.search.trim() ? ' · 关键词「' + state.search.trim() + '」' : '');

    if (!items.length) {
      dom.cardList.innerHTML = '';
      showEmpty(searching);
      return;
    }

    dom.emptyState.hidden = true;
    dom.cardList.innerHTML = items.map(cardHtml).join('');
  }

  function showEmpty(searching) {
    dom.emptyState.hidden = false;
    var noDataAtAll = state.data.items.length === 0;
    // 移除可能存在的附加按钮
    var extra = $('emptySampleBtn');
    if (extra) extra.remove();
    dom.emptyActionBtn.style.display = '';

    if (noDataAtAll) {
      dom.emptyTitle.textContent = '这里还没有代码';
      dom.emptyDesc.textContent = '新建第一段代码，或载入示例数据看看效果。';
      dom.emptyActionBtn.textContent = '新建代码';
      dom.emptyActionBtn.dataset.act = 'new';
      var actions = $('emptyActions');
      actions.insertAdjacentHTML('beforeend',
        '<button class="btn btn-ghost" id="emptySampleBtn">载入示例数据</button>');
      $('emptySampleBtn').addEventListener('click', loadSampleData);
    } else {
      dom.emptyTitle.textContent = '没有匹配的结果';
      dom.emptyDesc.textContent = '试试更换关键词，或清除当前的筛选条件。';
      dom.emptyActionBtn.textContent = '清除筛选';
      dom.emptyActionBtn.dataset.act = 'clear-filters';
    }
  }

  function cardHtml(item) {
    var title = getTitle(item);
    var body = getBody(item);
    var lang = getLang(item);
    var desc = getDesc(item);
    var isClipboard = item.type === 'clipboard';
    var preview = body.split('\n').slice(0, 14).join('\n');
    if (body.split('\n').length > 14) preview += '\n…';
    var codeHtml = isClipboard
      ? escapeHtml(preview)
      : highlight(preview, lang);

    var meta = '';
    if (item.type === 'template') {
      meta = '模板代码';
    } else if (item.type === 'problem') {
      meta = '题目代码' + (item.source ? ' · 来源：' + escapeHtml(item.source) : '');
    } else {
      meta = '云剪贴板';
    }

    var tagsHtml = (item.tags || []).map(function (tag) {
      return '<span class="tag">#' + escapeHtml(tag) + '</span>';
    }).join('');

    return '' +
      '<article class="code-card" data-id="' + escapeHtml(item.id) + '">' +
        '<div class="card-head">' +
          '<div class="card-title-row">' +
            '<h3 class="card-title"><a class="card-title-link" data-act="view">' + escapeHtml(title) + '</a></h3>' +
            '<div class="card-badges">' +
              (isClipboard ? '' : '<span class="badge badge-lang">' + escapeHtml(lang) + '</span>') +
              '<span class="badge badge-type-' + item.type + '">' + TYPE_LABELS[item.type] + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="card-meta">' + meta + '</div>' +
          (desc ? '<p class="card-desc">' + escapeHtml(desc) + '</p>' : '') +
          (tagsHtml ? '<div class="card-tags">' + tagsHtml + '</div>' : '') +
        '</div>' +
        (body ?
          '<div class="code-block' + (isClipboard ? ' clipboard-text' : '') + '">' +
            '<button class="copy-float" data-act="copy" title="复制">' +
              '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>复制' +
            '</button>' +
            '<pre><code>' + codeHtml + '</code></pre>' +
          '</div>' : '') +
        '<div class="card-foot">' +
          '<span class="card-time">更新于 ' + formatTime(item.updatedAt) + '</span>' +
          '<div class="card-actions">' +
            '<button class="action-btn" data-act="view">查看</button>' +
            (body ? '<button class="action-btn" data-act="copy">复制</button>' : '') +
            '<button class="action-btn" data-act="edit">编辑</button>' +
            '<button class="action-btn danger" data-act="delete">删除</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  // ---------------------------------------------------------------- 弹窗
  function openModal(modal) { modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { modal.hidden = true; if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = ''; }

  function openEditor(id, presetType) {
    state.editingId = id || null;
    var item = id ? state.data.items.filter(function (i) { return i.id === id; })[0] : null;
    var type = item ? item.type : (presetType || 'template');
    state.editingType = type;

    dom.editorTitle.textContent = item ? '编辑' + TYPE_LABELS[type] : '新建' + TYPE_LABELS[type];
    dom.editorForm.innerHTML = buildForm(type, item);
    openModal(dom.editorModal);
    var firstInput = dom.editorForm.querySelector('input:not([type="hidden"]), textarea');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 60);
  }

  function buildForm(type, item) {
    item = item || {};
    var tags = (item.tags || []).join(', ');
    var langOptions = LANG_OPTIONS.map(function (l) {
      return '<option value="' + l + '"></option>';
    }).join('');

    var html = '<datalist id="langOptions">' + langOptions + '</datalist>';

    if (!item.id) {
      html += '<div class="type-switch">' +
        ['template', 'problem', 'clipboard'].map(function (t) {
          return '<button type="button" class="type-option' + (type === t ? ' active' : '') +
            '" data-type="' + t + '">' + TYPE_LABELS[t] + '</button>';
        }).join('') + '</div>';
    }

    if (type === 'template') {
      html += field('名称', '<input class="form-control" name="name" maxlength="120" value="' + escapeHtml(item.name || '') + '" placeholder="例如：快速幂模板" required />', true);
      html += '<div class="form-row-inline">' +
        field('语言', '<input class="form-control" name="language" list="langOptions" maxlength="30" value="' + escapeHtml(item.language || 'cpp') + '" placeholder="cpp" />') +
        field('标签', '<input class="form-control" name="tags" maxlength="200" value="' + escapeHtml(tags) + '" placeholder="数学, 模板（逗号分隔）" />') +
        '</div>';
      html += field('说明', '<textarea class="form-control" name="description" maxlength="800" placeholder="这个模板是做什么的？有什么注意点？">' + escapeHtml(item.description || '') + '</textarea>');
      html += field('代码内容', '<textarea class="form-control code-input" name="code" spellcheck="false" placeholder="在此粘贴代码..." required>' + escapeHtml(item.code || '') + '</textarea>', true);
    } else if (type === 'problem') {
      html += field('题目标题', '<input class="form-control" name="title" maxlength="160" value="' + escapeHtml(item.title || '') + '" placeholder="例如：P3372 【模板】线段树 1" required />', true);
      html += '<div class="form-row-inline">' +
        field('来源', '<input class="form-control" name="source" maxlength="160" value="' + escapeHtml(item.source || '') + '" placeholder="洛谷 / Codeforces / LeetCode..." />') +
        field('语言', '<input class="form-control" name="language" list="langOptions" maxlength="30" value="' + escapeHtml(item.language || 'cpp') + '" placeholder="cpp" />') +
        '</div>';
      html += field('标签', '<input class="form-control" name="tags" maxlength="200" value="' + escapeHtml(tags) + '" placeholder="线段树, 数据结构（逗号分隔）" />');
      html += field('思路备注', '<textarea class="form-control" name="notes" maxlength="2000" placeholder="算法思路、复杂度、踩坑记录...">' + escapeHtml(item.notes || '') + '</textarea>');
      html += field('代码内容', '<textarea class="form-control code-input" name="code" spellcheck="false" placeholder="在此粘贴代码..." required>' + escapeHtml(item.code || '') + '</textarea>', true);
    } else {
      html += field('备注标题 <span class="form-hint">（可选）</span>', '<input class="form-control" name="title" maxlength="120" value="' + escapeHtml(item.title || '') + '" placeholder="给这段文本起个名字" />');
      html += field('标签', '<input class="form-control" name="tags" maxlength="200" value="' + escapeHtml(tags) + '" placeholder="便签, 待办（逗号分隔）" />');
      html += field('文本内容', '<textarea class="form-control" name="content" maxlength="20000" spellcheck="false" placeholder="粘贴任意文本..." required>' + escapeHtml(item.content || '') + '</textarea>', true);
    }
    return html;
  }

  function field(label, control, required) {
    if (required) {
      control = control.replace(/class="form-control/, 'data-required="1" class="form-control');
    }
    return '<div class="form-row">' +
      '<label class="form-label">' + label + (required ? '<span class="req">*</span>' : '') + '</label>' +
      control +
      '<div class="field-error">此项不能为空</div>' +
      '</div>';
  }

  function parseTags(raw) {
    return String(raw || '').split(/[,，、]/)
      .map(function (s) { return s.trim(); })
      .filter(function (s, i, arr) { return s && arr.indexOf(s) === i; })
      .slice(0, 12);
  }

  function submitEditor(e) {
    e.preventDefault();
    var form = dom.editorForm;
    var valid = true;
    Array.prototype.forEach.call(form.querySelectorAll('.form-row'), function (row) { row.classList.remove('invalid'); });
    Array.prototype.forEach.call(form.querySelectorAll('[data-required]'), function (el) {
      if (!el.value.trim()) {
        valid = false;
        var row = el.closest('.form-row');
        if (row) row.classList.add('invalid');
      }
    });
    if (!valid) { showToast('请填写必填项', 'error'); return; }

    var type = state.editingType;
    var now = Date.now();
    var existing = state.editingId
      ? state.data.items.filter(function (i) { return i.id === state.editingId; })[0]
      : null;

    var item = {
      id: existing ? existing.id : uid(),
      type: type,
      tags: parseTags(form.elements.tags ? form.elements.tags.value : ''),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    if (type === 'template') {
      item.name = form.elements.name.value.trim();
      item.language = (form.elements.language.value || 'plaintext').trim();
      item.description = form.elements.description.value.trim();
      item.code = form.elements.code.value;
    } else if (type === 'problem') {
      item.title = form.elements.title.value.trim();
      item.source = form.elements.source.value.trim();
      item.language = (form.elements.language.value || 'plaintext').trim();
      item.notes = form.elements.notes.value.trim();
      item.code = form.elements.code.value;
    } else {
      item.title = form.elements.title.value.trim();
      item.content = form.elements.content.value;
    }

    if (existing) {
      state.data.items[state.data.items.indexOf(existing)] = item;
    } else {
      state.data.items.push(item);
    }
    saveData();
    render();
    closeModal(dom.editorModal);
    showToast(existing ? '已保存修改' : '已新增' + TYPE_LABELS[type], 'success');
  }

  // ---------------------------------------------------------------- 查看
  function openView(id) {
    var item = state.data.items.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    state.viewingId = id;
    var title = getTitle(item);
    dom.viewTitle.textContent = title;

    var sections = [];
    if (item.type === 'problem' && item.source) {
      sections.push(viewSection('来源', escapeHtml(item.source)));
    }
    if (item.type === 'template' && item.description) {
      sections.push(viewSection('说明', escapeHtml(item.description)));
    }
    if (item.type === 'problem' && item.notes) {
      sections.push('<div class="view-section"><div class="view-label">思路备注</div><div class="view-value notes">' + escapeHtml(item.notes) + '</div></div>');
    }
    if ((item.tags || []).length) {
      sections.push(viewSection('标签', item.tags.map(function (t) {
        return '<span class="tag">#' + escapeHtml(t) + '</span>';
      }).join(' ')));
    }
    sections.push(viewSection('更新于', formatTime(item.updatedAt)));

    var body = getBody(item);
    if (body) {
      var isClipboard = item.type === 'clipboard';
      sections.push('<div class="view-section"><div class="view-label">' +
        (isClipboard ? '文本内容' : '代码内容 · ' + escapeHtml(getLang(item))) + '</div>' +
        '<pre class="view-code"><code>' +
        (isClipboard ? escapeHtml(body) : highlight(body, getLang(item))) +
        '</code></pre></div>');
    }

    dom.viewBody.innerHTML = sections.join('');
    openModal(dom.viewModal);
  }

  function viewSection(label, value) {
    return '<div class="view-section"><div class="view-label">' + label + '</div>' +
      '<div class="view-value">' + value + '</div></div>';
  }

  // ---------------------------------------------------------------- 操作
  function copyText(text, btn) {
    var done = function () {
      showToast('已复制到剪贴板', 'success');
      if (btn) {
        var old = btn.innerHTML;
        btn.classList.add('copied');
        btn.textContent = '已复制';
        setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = old; }, 1600);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { showToast('复制失败，请手动选择文本', 'error'); }
    document.body.removeChild(ta);
  }

  function deleteItem(id) {
    var item = state.data.items.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    confirmAction('删除确认', '确定要删除「' + getTitle(item) + '」吗？此操作不可撤销。', function () {
      state.data.items = state.data.items.filter(function (i) { return i.id !== id; });
      if (state.viewingId === id) closeModal(dom.viewModal);
      saveData();
      render();
      showToast('已删除', 'success');
    });
  }

  function confirmAction(title, message, callback) {
    dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    state.confirmAction = callback;
    openModal(dom.confirmModal);
  }

  // ---------------------------------------------------------------- 导入导出
  function exportData() {
    var payload = {
      app: 'CodeVault',
      version: 1,
      exportedAt: new Date().toISOString(),
      items: state.data.items
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'codevault-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('已导出 ' + state.data.items.length + ' 条数据', 'success');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      var parsed;
      try { parsed = JSON.parse(ev.target.result); } catch (e) {
        showToast('JSON 解析失败，请检查文件格式', 'error');
        return;
      }
      var incoming = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(incoming)) {
        showToast('文件中没有找到可导入的数据', 'error');
        return;
      }
      confirmAction('导入数据', '将合并 ' + incoming.length + ' 条数据（相同 ID 会跳过），确定继续吗？', function () {
        var ids = {};
        state.data.items.forEach(function (i) { ids[i.id] = true; });
        var added = 0;
        incoming.forEach(function (item) {
          if (!item || !item.id || ids[item.id]) return;
          if (!item.type || ['template', 'problem', 'clipboard'].indexOf(item.type) < 0) return;
          var now = Date.now();
          state.data.items.push({
            id: item.id,
            type: item.type,
            name: item.name || '',
            title: item.title || '',
            source: item.source || '',
            language: item.language || 'plaintext',
            description: item.description || '',
            notes: item.notes || '',
            code: item.code || '',
            content: item.content || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            createdAt: item.createdAt || now,
            updatedAt: item.updatedAt || now
          });
          ids[item.id] = true;
          added++;
        });
        saveData();
        render();
        showToast('已导入 ' + added + ' 条数据', 'success');
      });
    };
    reader.readAsText(file, 'utf-8');
  }

  function clearAll() {
    if (!state.data.items.length) { showToast('当前没有数据'); return; }
    confirmAction('清空所有数据', '将删除全部 ' + state.data.items.length + ' 条代码，且无法恢复。建议先导出备份。确定继续吗？', function () {
      state.data.items = [];
      state.tag = '';
      state.lang = '';
      saveData();
      render();
      showToast('数据已清空', 'success');
    });
  }

  // ---------------------------------------------------------------- 示例数据
  function loadSampleData() {
    var now = Date.now();
    var samples = [
      {
        id: uid(), type: 'template', name: '快速幂（二分幂）', language: 'cpp',
        description: '在 O(log n) 时间内计算 a^b mod mod，注意底数取模与 long long 溢出。',
        code: 'long long qpow(long long a, long long b, long long mod) {\n' +
          '    a %= mod;\n' +
          '    long long res = 1 % mod;\n' +
          '    while (b) {\n' +
          '        if (b & 1) res = res * a % mod;\n' +
          '        a = a * a % mod;\n' +
          '        b >>= 1;\n' +
          '    }\n' +
          '    return res;\n' +
          '}',
        tags: ['数学', '模板'], createdAt: now, updatedAt: now
      },
      {
        id: uid(), type: 'template', name: '并查集路径压缩', language: 'cpp',
        description: '带路径压缩与按秩合并的并查集模板。',
        code: 'vector<int> fa, sz;\n' +
          'void init(int n) {\n' +
          '    fa.resize(n + 1); sz.assign(n + 1, 1);\n' +
          '    iota(fa.begin(), fa.end(), 0);\n' +
          '}\n' +
          'int find(int x) { return fa[x] == x ? x : fa[x] = find(fa[x]); }\n' +
          'void unite(int a, int b) {\n' +
          '    a = find(a); b = find(b);\n' +
          '    if (a != b) { if (sz[a] < sz[b]) swap(a, b); fa[b] = a; sz[a] += sz[b]; }\n' +
          '}',
        tags: ['数据结构', '模板'], createdAt: now, updatedAt: now
      },
      {
        id: uid(), type: 'problem', title: 'P3372 【模板】线段树 1', source: '洛谷 P3372', language: 'cpp',
        notes: '区间加 + 区间求和。核心是 pushup / pushdown，懒标记下传时注意只在非叶子节点下传。\n复杂度：建树 O(n)，单次操作 O(log n)。',
        code: 'struct Node { long long sum, lazy; } tr[MAXN << 2];\n' +
          'void pushup(int p) { tr[p].sum = tr[p<<1].sum + tr[p<<1|1].sum; }\n' +
          'void pushdown(int p, int l, int r) {\n' +
          '    if (!tr[p].lazy) return;\n' +
          '    int mid = (l + r) >> 1, k = tr[p].lazy;\n' +
          '    tr[p<<1].sum += k * (mid - l + 1); tr[p<<1].lazy += k;\n' +
          '    tr[p<<1|1].sum += k * (r - mid);     tr[p<<1|1].lazy += k;\n' +
          '    tr[p].lazy = 0;\n' +
          '}',
        tags: ['线段树', '数据结构'], createdAt: now, updatedAt: now
      },
      {
        id: uid(), type: 'problem', title: 'Two Sum', source: 'LeetCode 1', language: 'python',
        notes: '哈希表一次遍历，边查边存，返回下标而非值。',
        code: 'def two_sum(nums, target):\n' +
          '    seen = {}\n' +
          '    for i, num in enumerate(nums):\n' +
          '        if target - num in seen:\n' +
          '            return [seen[target - num], i]\n' +
          '        seen[num] = i\n' +
          '    return []',
        tags: ['哈希表', 'leetcode'], createdAt: now, updatedAt: now
      },
      {
        id: uid(), type: 'clipboard', title: '常用 Git 命令',
        content: 'git status\n' +
          'git add .\n' +
          'git commit -m "message"\n' +
          'git push origin main\n\n' +
          '# 撤销上一次提交但保留改动\n' +
          'git reset --soft HEAD^',
        tags: ['git', '便签'], createdAt: now, updatedAt: now
      },
      {
        id: uid(), type: 'clipboard', title: '',
        content: '这里是剪贴板里的任意临时文本。\n可以在左侧「其他 / 云剪贴板」分类里快速粘贴新片段。',
        tags: ['临时'], createdAt: now, updatedAt: now
      }
    ];
    state.data.items = state.data.items.concat(samples);
    saveData();
    render();
    showToast('已载入 ' + samples.length + ' 条示例数据', 'success');
  }

  // ---------------------------------------------------------------- 事件绑定
  function bindEvents() {
    // 导航分类
    document.addEventListener('click', function (e) {
      var nav = e.target.closest('.nav-item[data-category]');
      if (nav) {
        e.preventDefault();
        state.category = nav.dataset.category;
        Array.prototype.forEach.call(document.querySelectorAll('.nav-item[data-category]'), function (el) {
          el.classList.toggle('active', el === nav);
        });
        closeSidebar();
        render();
        return;
      }
      var tagBtn = e.target.closest('[data-tag]');
      if (tagBtn) {
        state.tag = state.tag === tagBtn.dataset.tag ? '' : tagBtn.dataset.tag;
        render();
        return;
      }
      var chip = e.target.closest('[data-lang]');
      if (chip) {
        state.lang = state.lang === chip.dataset.lang ? '' : chip.dataset.lang;
        render();
        return;
      }
      var dataAction = e.target.closest('[data-action]');
      if (dataAction && !e.target.closest('.dropdown-menu')) {
        e.preventDefault();
        handleGlobalAction(dataAction.dataset.action);
        return;
      }
      if (e.target.closest('[data-close-modal]')) {
        var modal = e.target.closest('.modal');
        if (modal) closeModal(modal);
      }
    });

    // 卡片操作（事件委托）
    dom.cardList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var card = e.target.closest('.code-card');
      if (!card) return;
      var id = card.dataset.id;
      var item = state.data.items.filter(function (i) { return i.id === id; })[0];
      if (!item) return;
      switch (btn.dataset.act) {
        case 'view': openView(id); break;
        case 'edit': openEditor(id); break;
        case 'delete': deleteItem(id); break;
        case 'copy': copyText(getBody(item), btn); break;
      }
    });

    dom.emptyActionBtn.addEventListener('click', function () {
      if (dom.emptyActionBtn.dataset.act === 'new') openEditor(null, 'template');
      else {
        state.search = ''; state.tag = ''; state.lang = '';
        dom.searchInput.value = '';
        render();
      }
    });

    // 搜索
    var searchTimer = null;
    dom.searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = dom.searchInput.value;
        render();
      }, 120);
    });

    // 新建按钮
    dom.newBtn.addEventListener('click', function () { openEditor(null, 'template'); });
    $('headingNewBtn').addEventListener('click', function () { openEditor(null, 'template'); });
    dom.brandHome.addEventListener('click', function (e) {
      e.preventDefault();
      state.category = 'all'; state.search = ''; state.tag = ''; state.lang = '';
      dom.searchInput.value = '';
      Array.prototype.forEach.call(document.querySelectorAll('.nav-item[data-category]'), function (el) {
        el.classList.toggle('active', el.dataset.category === 'all');
      });
      render();
    });

    // 更多菜单
    dom.moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dom.moreMenu.hidden = !dom.moreMenu.hidden;
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#moreDropdown')) dom.moreMenu.hidden = true;
    });
    dom.moreMenu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      dom.moreMenu.hidden = true;
      handleGlobalAction(btn.dataset.action);
    });

    // 侧栏开关
    dom.sidebarToggle.addEventListener('click', function () {
      var open = dom.sidebar.classList.toggle('open');
      dom.sidebarBackdrop.hidden = !open;
    });
    dom.sidebarBackdrop.addEventListener('click', closeSidebar);

    // 编辑器表单
    dom.editorForm.addEventListener('submit', submitEditor);
    dom.editorForm.addEventListener('click', function (e) {
      var opt = e.target.closest('.type-option');
      if (!opt) return;
      state.editingType = opt.dataset.type;
      Array.prototype.forEach.call(dom.editorForm.querySelectorAll('.type-option'), function (el) {
        el.classList.toggle('active', el === opt);
      });
      var item = state.editingId
        ? state.data.items.filter(function (i) { return i.id === state.editingId; })[0] : null;
      var preserve = item ? null : null;
      dom.editorForm.innerHTML = buildForm(state.editingType, preserve);
      // 切换类型时保留已填的标签
      var tagInput = dom.editorForm.elements.tags;
      if (tagInput) tagInput.value = dom.editorForm._lastTags || '';
    });
    dom.editorForm.addEventListener('input', function () {
      if (dom.editorForm.elements.tags) dom.editorForm._lastTags = dom.editorForm.elements.tags.value;
    });

    // 查看详情操作
    dom.viewCopyBtn.addEventListener('click', function () {
      var item = state.data.items.filter(function (i) { return i.id === state.viewingId; })[0];
      if (item) copyText(getBody(item), dom.viewCopyBtn);
    });
    dom.viewEditBtn.addEventListener('click', function () {
      var id = state.viewingId;
      closeModal(dom.viewModal);
      if (id) openEditor(id);
    });

    // 确认弹窗
    dom.confirmOk.addEventListener('click', function () {
      var action = state.confirmAction;
      state.confirmAction = null;
      closeModal(dom.confirmModal);
      if (typeof action === 'function') action();
    });

    // 快速粘贴
    dom.quickPasteSave.addEventListener('click', function () {
      var content = dom.quickPasteInput.value.trim();
      if (!content) { showToast('请先粘贴文本内容', 'error'); return; }
      var now = Date.now();
      state.data.items.push({
        id: uid(), type: 'clipboard',
        title: dom.quickPasteTitle.value.trim(),
        content: content,
        tags: [],
        createdAt: now, updatedAt: now
      });
      dom.quickPasteInput.value = '';
      dom.quickPasteTitle.value = '';
      saveData();
      render();
      showToast('已保存到云剪贴板', 'success');
    });

    // 导入文件
    dom.importFile.addEventListener('change', function () {
      if (dom.importFile.files && dom.importFile.files[0]) {
        importData(dom.importFile.files[0]);
        dom.importFile.value = '';
      }
    });

    // 快捷键
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === 'Escape') {
        var open = document.querySelectorAll('.modal:not([hidden])');
        if (open.length) closeModal(open[open.length - 1]);
        else {
          dom.moreMenu.hidden = true;
          closeSidebar();
        }
      }

      if (!typing && e.key === '/' ) {
        e.preventDefault();
        dom.searchInput.focus();
      }

      if (typing && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!dom.editorModal.hidden) {
          e.preventDefault();
          dom.editorSubmit.click();
        }
      }
    });
  }

  function handleGlobalAction(action) {
    switch (action) {
      case 'export': exportData(); break;
      case 'import': dom.importFile.click(); break;
      case 'clear': clearAll(); break;
      case 'sample': loadSampleData(); break;
    }
  }

  function closeSidebar() {
    dom.sidebar.classList.remove('open');
    dom.sidebarBackdrop.hidden = true;
  }

  // ---------------------------------------------------------------- 启动
  function init() {
    state.data = loadData();
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
