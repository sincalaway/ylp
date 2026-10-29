#!/usr/bin/env python3
"""Import public-domain classic texts from zh.wikisource.org into content/books/.

Usage: python3 scripts/import-wikisource.py
Each output file credits its Wikisource page and revision. Texts are {{PD-old}}.
"""
import html, json, re, time, urllib.parse, urllib.request
from pathlib import Path

API = 'https://zh.wikisource.org/w/api.php'
UA = {'User-Agent': 'yuluoping-importer/1.0 (https://github.com/sincalaway/ylp)'}
OUT = Path(__file__).resolve().parent.parent / 'content' / 'books'

def fetch(title):
    q = urllib.parse.urlencode(dict(action='query', titles=title, prop='revisions', rvprop='content|ids',
                                    rvslots='main', format='json', formatversion=2))
    time.sleep(1)
    pg = json.load(urllib.request.urlopen(urllib.request.Request(f'{API}?{q}', headers=UA)))['query']['pages'][0]
    rev = pg['revisions'][0]
    return rev['slots']['main']['content'], rev['revid']

def strip_templates(s):
    out, depth, i = [], 0, 0
    while i < len(s):
        if s.startswith('{{', i): depth += 1; i += 2; continue
        if depth and s.startswith('}}', i): depth -= 1; i += 2; continue
        if not depth: out.append(s[i])
        i += 1
    return ''.join(out)

def clean(s):
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    s = strip_templates(s)
    s = re.sub(r'-\{(?:[^|}]*\|)?([^}]*)\}-', r'\1', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r"'{2,}", '', s)
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'</?[a-zA-Z][^>]*>', '', s)
    s = s.replace('__NOTOC__', '')
    s = html.unescape(s)
    return s

def to_md(s, levels):
    """levels maps wikitext heading depth -> markdown prefix ('##', '###', or 'bold')."""
    lines = []
    for raw in clean(s).split('\n'):
        line = raw.strip()
        m = re.match(r'^(=+)\s*(.+?)\s*=+$', line)
        if m:
            lv = levels.get(len(m.group(1)), 'bold')
            title = m.group(2).strip().strip('【】')
            lines += ['', f'**【{title}】**' if lv == 'bold' else f'{lv} {title}', '']
            continue
        if re.fullmatch(r'【[^】]+】', line):
            lines += ['', f'**{line}**', '']; continue
        line = re.sub(r'^[*#:;]+\s*', '', line)       # list/indent markup
        line = re.sub(r'^(\d+)\.', r'\1\\.', line)     # avoid accidental ordered lists
        lines.append(line)
    # Join source lines: a short line without closing punctuation (a recipe name, an
    # ingredient list) keeps its own line; a long line that breaks mid-sentence is a
    # transcription wrap and is joined directly (no space between Chinese characters).
    out = []
    for line in lines:
        prev = out[-1] if out else ''
        if line and prev and not prev.startswith(('#', '**', '>')) and not line.startswith(('#', '**')):
            if re.search(r'[。」』）)？！；：︰]$', prev) or len(prev) < 30:
                out.append('')
            else:
                out[-1] = prev + line; continue
        out.append(line)
    md = '\n'.join(out)
    md = re.sub(r'\n{3,}', '\n\n', md).strip()
    return md

def section(text, start, end=None):
    i = text.find(start)
    if i < 0: raise SystemExit(f'missing section start: {start}')
    j = text.find(end, i + len(start)) if end else -1
    return text[i: j if j > 0 else None]

def page_url(t): return 'https://zh.wikisource.org/wiki/' + urllib.parse.quote(t)

def write(slug, meta, intro, body):
    fm = '\n'.join(f'{k}: {v}' for k, v in meta.items())
    (OUT / f'{slug}.md').write_text(f'---\n{fm}\n---\n\n{intro}\n\n{body}\n', encoding='utf-8')
    print('wrote', slug, len(body))

def credit(pages):
    src = '；'.join(f'[《{t}》]({page_url(t)})（修訂版本 {r}）' for t, r in pages)
    return (f'> 原文來源：維基文庫 {src}。古籍原文屬公有領域（PD-old），本站僅轉換格式，保留繁體原字。'
            '\n>\n> 閱讀提示：此為歷史文獻原文，不同版本文字、斷句互有出入；所載方藥與主治不構成現代醫療建議，健康問題請諮詢專業醫師。')

def main():
    # 1. 神農本草經 (full)
    t, r = fetch('神農本草經')
    write('shen-nong-ben-cao-jing-yuanwen', dict(title='神农本草经（原文）', author='佚名（托名神农）', dynasty='漢', category='本草类',
          summary='维基文库通行辑本全文（繁体原文），分上、中、下三经，按玉石、草、木、果菜、米谷、虫兽各部收药。', coverLabel='本经原文', featured='false'),
          credit([('神農本草經', r)]), to_md(t, {2: '##', 3: '###'}))

    # 2. 黃帝內經·素問 卷一至卷三
    parts, mds = [], []
    for vol in ['第一卷', '第二卷', '第三卷']:
        title = f'黃帝內經/素問{vol}'
        tx, rv = fetch(title); parts.append((title, rv)); mds.append(to_md(tx, {2: '##', 3: '###'}))
    write('huang-di-nei-jing-su-wen-yuanwen', dict(title='黄帝内经·素问（原文·卷一至卷三）', author='佚名', dynasty='先秦至漢', category='医经类',
          summary='《素问》前三卷原文十一篇（繁体）：上古天真论、四气调神大论、生气通天论、阴阳应象大论、灵兰秘典论等。', coverLabel='素问原文', featured='false'),
          credit(parts), '\n\n'.join(mds))

    # 3. 傷寒論（宋本）: 張仲景原序 + 已校訂的第五至第十四篇
    t, r = fetch('傷寒論')
    body = section(t, '== 張仲景原序 ==', '==  卷第一 ==') + '\n' + section(t, '=== 辨太陽病脈證並治（上）第五 ===', '=== 辨不可發汗病脈證並治第十五 ===')
    write('shang-han-lun-yuanwen', dict(title='伤寒论（原文·宋本选）', author='东汉·张仲景', dynasty='东汉', category='方书类',
          summary='宋本《伤寒论》张仲景原序及六经病篇（第五至第十四篇）繁体原文，取维基文库已校订部分。', coverLabel='傷寒原文', featured='false'),
          credit([('傷寒論', r)]) + '\n>\n> 維基文庫註明：序及第五至十四篇條文已校訂，方劑部分尚未校訂。',
          to_md(body, {2: '##', 3: '##'}))

    # 4. 本草綱目：本站十二味藥條目（至【附方】前）
    entries = [('本草綱目/草之一', '人參'), ('本草綱目/草之一', '甘草'), ('本草綱目/草之一', '黃耆'), ('本草綱目/草之三', '當歸'),
               ('本草綱目/木之三', '枸杞地骨皮'), ('本草綱目/草之四', '菊'), ('本草綱目/草之七', '忍冬'), ('本草綱目/果之二', '橘'),
               ('本草綱目/木之四', '茯苓'), ('本草綱目/草之一', '朮'), ('本草綱目/菜之一', '生薑'), ('本草綱目/草之三', '薄荷')]
    cache, parts, mds = {}, {}, []
    for page, name in entries:
        if page not in cache: cache[page] = fetch(page); parts[page] = cache[page][1]
        tx = cache[page][0]
        m = re.search(rf'^(=+)\s*{re.escape(name)}\s*=+\s*$', tx, re.M)
        if not m: raise SystemExit(f'missing {name}')
        lvl = len(m.group(1)); rest = tx[m.end():]
        # stop at next herb heading of same/higher level, but keep sub-sections
        stop = None
        for h in re.finditer(r'^(=+)[^=\n]+=+\s*$', rest, re.M):
            if len(h.group(1)) <= lvl: stop = h.start(); break
        chunk = rest[:stop]
        cut = re.search(r'^(=+\s*)?【?附方】?|^=+\s*附方\s*=+', chunk, re.M)
        if cut: chunk = chunk[:cut.start()]
        mds.append(f'## {name.replace("枸杞地骨皮", "枸杞（地骨皮）")}\n\n' + to_md(chunk, {}))
    write('ben-cao-gang-mu-yuanwen', dict(title='本草纲目（原文·本草堂十二味）', author='明·李时珍', dynasty='明', category='本草类',
          summary='《本草纲目》中人参、甘草、黄芪、当归、枸杞、菊、忍冬、橘、茯苓、术、生姜、薄荷十二条繁体原文（释名、集解、气味、主治、发明，附方从略）。',
          coverLabel='纲目原文', featured='false'),
          credit(list(parts.items())) + '\n>\n> 各條目「附方」部分篇幅浩繁，且多為古代經驗方，本站從略。',
          '\n\n'.join(mds))

if __name__ == '__main__':
    main()
