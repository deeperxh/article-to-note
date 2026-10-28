// Executed in the page by Playwright; deliberately reads rendered content only.
export function zhihuTarget(input) {
  const u = new URL(input);
  const answer = u.hostname === 'www.zhihu.com' && u.pathname.match(/^\/question\/\d+\/answer\/(\d+)\/?$/);
  const article = u.hostname === 'zhuanlan.zhihu.com' && u.pathname.match(/^\/p\/(\d+)\/?$/);
  if (u.protocol !== 'https:' || (!answer && !article)) throw new Error('Browser backend supports HTTPS Zhihu single-answer and zhuanlan /p/ URLs only.');
  u.search = ''; u.hash = '';
  return { kind: answer ? 'answer' : 'article', id: (answer || article)[1], url: u.href };
}

export function extractZhihuDocument(target) {
  const visible = el => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  const pageText = document.body?.innerText || '';
  const visibleMatches = selector => [...document.querySelectorAll(selector)].filter(visible);
  let scope, ambiguous = false;
  if (target.kind === 'answer') {
    const items = [...document.querySelectorAll('.AnswerItem')];
    scope = items.find(el => {
      try { return String(JSON.parse(el.getAttribute('data-zop') || '{}').itemId) === target.id; } catch { return false; }
    });
    if (!scope && items.length === 1) {
      try { if (!JSON.parse(items[0].getAttribute('data-zop') || '{}').itemId) scope = items[0]; } catch {}
    }
    ambiguous = !scope && items.length > 1;
  } else scope = document.querySelector('article.Post-Main, .Post-Main, article');
  const candidate = scope?.querySelector(target.kind === 'answer' ? '.RichContent-inner .RichText, .RichContent-inner' : '.Post-RichTextContainer .RichText, .Post-RichText, .RichText');
  const content = visible(candidate) ? candidate : null;
  const blockers = visibleMatches('.Modal, .SignFlow, .LoginModal, [class*="Captcha"], [class*="Paywall"], .KfeCollection-PurchaseBtn, .RichContent-purchase, .PurchaseButton');
  const blockerText = blockers.map(el => el.innerText).join('\n');
  const purchaseControls = [...(scope?.querySelectorAll('button,a') || [])].filter(visible).map(el => el.innerText.trim()).filter(text => /^(开通.*会员|购买.*阅读|.*解锁全文|购买盐选)/.test(text)).join('\n');
  let access = 'readable';
  if (/安全验证|验证码|验证后继续/.test(blockerText) || (!content && /安全验证|访问异常|请求过于频繁/.test(pageText))) access = 'verification_required';
  else if (/开通.*会员|购买.*阅读|付费.*阅读|会员.*解锁|解锁.*全文|购买盐选/.test(blockerText + '\n' + purchaseControls)) access = 'paywall';
  else if (/登录|注册/.test(blockerText) || /\/signin|\/sign_up/.test(location.pathname) || (!content && /登录后.*查看|登录.*知乎/.test(pageText))) access = 'login_required';
  else if (!content) access = ambiguous ? 'ambiguous_answer' : 'content_not_found';
  const issues = [];
  if (access !== 'readable') issues.push(access);
  if (!content) return { access, issues, html: '', text: '', title: document.title, images: [], headings: [], expandable: false, paragraphCount: 0, codeBlocks: 0, pageUrl: location.href, scrollPosition: scrollY, atBodyEnd: false };

  const expand = [...scope.querySelectorAll('button, .ContentItem-expandButton, .RichContent-expandButton')].find(el => visible(el) && /^(展开阅读全文|展开全部|显示全部|阅读全文)$/.test(el.innerText.trim()));
  if (expand) issues.push('collapsed_content');
  if (/展开阅读全文|剩余.*内容.*会员|试读结束|购买后.*阅读|开通.*阅读全文/.test(content.innerText)) issues.push('preview_or_truncation_marker');
  for (let el = content; el && el !== scope.parentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (['hidden','clip'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 8) { issues.push('css_clipped_content'); break; }
  }
  const cloned = content.cloneNode(true), images = [];
  const originalNodes = [...content.querySelectorAll('*')], cloneNodes = [...cloned.querySelectorAll('*')];
  // Do not export hidden DOM as though it had been presented to the user.
  originalNodes.forEach((el, i) => { const style = getComputedStyle(el); if (style.display === 'none' || style.visibility === 'hidden') cloneNodes[i].remove(); });
  cloned.querySelectorAll('script, style, iframe, button, noscript').forEach(el => el.remove());
  [...cloned.querySelectorAll('img')].forEach(img => {
    const original = originalNodes[cloneNodes.indexOf(img)];
    const tex = img.getAttribute('data-tex') || (img.getAttribute('eeimg') === '1' ? img.getAttribute('alt') : null);
    if (tex) { img.replaceWith(document.createTextNode(`$${tex}$`)); return; }
    const candidates = ['data-original','data-actualsrc','data-src'].map(name => original.getAttribute(name));
    const srcset = original.getAttribute('srcset');
    if (srcset) candidates.push(srcset.split(',').at(-1).trim().split(/\s+/)[0]);
    candidates.push(original.currentSrc, original.getAttribute('src'));
    const raw = candidates.find(value => value && !/^(data:|blob:|about:)/i.test(value));
    let url = null;
    try { if (raw) { const u = new URL(raw, location.href); if (/^https?:$/.test(u.protocol)) url = u.href; } } catch {}
    const alt = original.getAttribute('alt') || '';
    images.push({ url, alt, loaded: original.complete && original.naturalWidth > 0 });
    if (url) img.setAttribute('src', url);
    else { img.replaceWith(document.createTextNode('[Image URL unavailable]')); issues.push('image_url_missing'); }
    for (const name of [...img.attributes].map(a => a.name)) if (!['src','alt','title'].includes(name)) img.removeAttribute(name);
  });
  cloned.querySelectorAll('a[href]').forEach(a => { try { a.setAttribute('href', new URL(a.getAttribute('href'), location.href).href); } catch { a.removeAttribute('href'); } });
  const text = content.innerText.trim();
  if (!text && !images.length) issues.push('empty_body');
  return {
    access, issues: [...new Set(issues)], html: cloned.innerHTML, text,
    title: (document.querySelector(target.kind === 'answer' ? '.QuestionHeader-title, h1' : '.Post-Title, h1')?.innerText || document.title).trim(),
    author: scope.querySelector('.AuthorInfo-name')?.textContent?.trim() || null,
    images, headings: [...content.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(el => el.innerText.trim()),
    paragraphCount: content.querySelectorAll('p').length, codeBlocks: content.querySelectorAll('pre').length,
    expandable: !!expand, pageUrl: location.href, scrollPosition: scrollY, atBodyEnd: content.getBoundingClientRect().bottom <= innerHeight + 8
  };
}

export function expandZhihuBody(target) {
  // Select the same answer rather than expanding neighbouring answers or comments.
  const items = [...document.querySelectorAll('.AnswerItem')];
  const scope = target.kind === 'answer' ? items.find(el => { try { return String(JSON.parse(el.getAttribute('data-zop') || '{}').itemId) === target.id; } catch { return false; } }) || (items.length === 1 && !items[0].getAttribute('data-zop') ? items[0] : null) : document.querySelector('article.Post-Main, .Post-Main, article');
  const button = [...(scope?.querySelectorAll('button, .ContentItem-expandButton, .RichContent-expandButton') || [])].find(el => /^(展开阅读全文|展开全部|显示全部|阅读全文)$/.test(el.innerText.trim()) && el.getClientRects().length);
  if (button) { button.click(); return true; }
  return false;
}

export function scrollZhihuBody(target) {
  const items = [...document.querySelectorAll('.AnswerItem')];
  const scope = target.kind === 'answer' ? items.find(el => { try { return String(JSON.parse(el.getAttribute('data-zop') || '{}').itemId) === target.id; } catch { return false; } }) || (items.length === 1 && !items[0].getAttribute('data-zop') ? items[0] : null) : document.querySelector('article.Post-Main, .Post-Main, article');
  const content = scope?.querySelector(target.kind === 'answer' ? '.RichContent-inner' : '.Post-RichTextContainer, .Post-RichText, .RichText');
  if (!content) return;
  // Scroll in viewport-sized increments so images between top and bottom can load.
  const bottom = content.getBoundingClientRect().bottom + scrollY;
  scrollTo(0, Math.min(scrollY + innerHeight * 0.8, bottom));
}
