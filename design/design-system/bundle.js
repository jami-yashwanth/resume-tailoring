/* @ds-bundle: {"format":4,"namespace":"Rezz","components":[{"name":"Button"},{"name":"Badge"},{"name":"SourceTag"},{"name":"Highlight"},{"name":"ChangeLine"},{"name":"GapPrompt"},{"name":"ResumeSheet"},{"name":"PassCard"},{"name":"PromiseStrip"},{"name":"Wordmark"}]} */
(function () {
  var React = window.React, h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(p, keys) { var o = {}; for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k) && keys.indexOf(k) < 0) o[k] = p[k]; } return o; }

  function Button(p) {
    var attrs = omit(p, ['variant', 'size', 'block', 'className', 'children']);
    attrs.type = attrs.type || 'button';
    attrs.className = cx('sc-btn', 'sc-btn--' + (p.variant || 'primary'), p.size && p.size !== 'md' && 'sc-btn--' + p.size, p.block && 'sc-btn--block', p.className);
    return h('button', attrs, p.children);
  }

  function Badge(p) {
    return h('span', { className: cx('sc-badge', p.tone && p.tone !== 'neutral' && 'sc-badge--' + p.tone, p.className) }, p.children);
  }

  function SourceTag(p) {
    return h('span', { className: cx('sc-src', p.className) },
      h('span', { className: 'sc-src__mark', 'aria-hidden': 'true' }, '✓'),
      h('span', null, 'from: ' + (p.from || '')));
  }

  function Highlight(p) {
    return h(React.Fragment, null,
      p.was ? h('del', { className: 'sc-was' }, p.was) : null,
      p.was ? ' ' : null,
      h('mark', { className: cx('sc-hl', p.animate && 'sc-hl--sweep', p.className) }, p.children));
  }

  function ChangeLine(p) {
    return h('div', { className: cx('sc-change', p.className) },
      h('span', { className: 'sc-change__dot', 'aria-hidden': 'true' }),
      h('div', null,
        h('p', { className: 'sc-change__text' }, h(Highlight, { was: p.was, animate: p.animate }, p.text)),
        h('div', { className: 'sc-change__meta' },
          p.from ? h(SourceTag, { from: p.from }) : null,
          p.reason ? h('span', null, p.reason) : null,
          p.onUndo ? h(Button, { variant: 'ghost', size: 'sm', onClick: p.onUndo }, 'Undo') : null)));
  }

  function GapPrompt(p) {
    return h('div', { className: cx('sc-gap', p.className) },
      h('div', null, h(Badge, { tone: 'gap' }, 'Not in your resume')),
      h('p', { className: 'sc-gap__title' }, p.skill),
      h('p', { className: 'sc-gap__body' }, 'The job lists it as ' + (p.level || 'a requirement').toLowerCase() + '. Add it to your resume? Recruiters may ask you about it.'),
      h('div', { className: 'sc-gap__actions' },
        h(Button, { variant: 'secondary', size: 'sm', onClick: p.onSkip }, 'Skip'),
        h(Button, { variant: 'secondary', size: 'sm', onClick: p.onAdd }, 'Add it')));
  }

  function ResumeSheet(p) {
    return h('div', { className: cx('sc-sheet', p.className) },
      p.name ? h('p', { className: 'sc-sheet__name' }, p.name) : null,
      p.role ? h('p', { className: 'sc-sheet__role' }, p.role) : null,
      (p.name || p.role) ? h('hr', { className: 'sc-sheet__rule' }) : null,
      p.children);
  }

  function PassCard(p) {
    return h('div', { className: cx('sc-pass', p.featured && 'sc-pass--featured', p.className) },
      h('p', { className: 'sc-pass__name' }, p.name),
      h('p', { className: 'sc-pass__price' }, p.price),
      p.per ? h('p', { className: 'sc-pass__per' }, p.per) : null,
      h('ul', null, (p.features || []).map(function (f, i) { return h('li', { key: i }, f); })),
      h(Button, { variant: p.featured ? 'primary' : 'secondary', block: true, onClick: p.onSelect }, p.cta || 'Buy with UPI'),
      h('p', { className: 'sc-pass__note' }, p.note || 'Paid once. Does not renew.'));
  }

  var PROMISES = ['Nothing added behind your back', 'No fake ATS score', 'No auto-renew', 'Your own design'];
  function PromiseStrip(p) {
    return h('ul', { className: cx('sc-promises', p.className) },
      (p.items || PROMISES).map(function (t, i) { return h('li', { key: i }, t); }));
  }

  function Wordmark(p) {
    return h('span', { className: cx('sc-wordmark', p.className), style: { fontSize: (p.size || 32) + 'px' }, role: 'img', 'aria-label': 'Rezz' },
      h('span', { className: 'sc-wordmark__stroke', 'aria-hidden': 'true' }),
      h('span', { 'aria-hidden': 'true' }, 'rezz'));
  }

  var api = { Button: Button, Badge: Badge, SourceTag: SourceTag, Highlight: Highlight, ChangeLine: ChangeLine, GapPrompt: GapPrompt, ResumeSheet: ResumeSheet, PassCard: PassCard, PromiseStrip: PromiseStrip, Wordmark: Wordmark };
  window.Rezz = window.Rezz || {};
  Object.assign(window.Rezz, api);
})();
