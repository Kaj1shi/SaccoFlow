// ── password-ui.js ──────────────────────────────────────────────────────────
// Shared password helpers for the HTML pages:
//   - PasswordUI.attachToggle(inputId): adds a show/hide (eye) button
//   - PasswordUI.attachChecklist(inputId): live requirements list that turns
//     each rule from red to green as it is satisfied
//   - PasswordUI.isValid(password): true when every rule passes

(function () {
  'use strict';

  var RULES = [
    { id: 'length',  label: 'At least 8 characters',          test: function (p) { return p.length >= 8; } },
    { id: 'upper',   label: 'An uppercase letter (A\u2013Z)', test: function (p) { return /[A-Z]/.test(p); } },
    { id: 'lower',   label: 'A lowercase letter (a\u2013z)',  test: function (p) { return /[a-z]/.test(p); } },
    { id: 'digit',   label: 'A number (0\u20139)',            test: function (p) { return /\d/.test(p); } },
    { id: 'special', label: 'A special character (!@#$%\u2026)', test: function (p) { return /[^A-Za-z0-9]/.test(p); } },
  ];

  function isValid(password) {
    return RULES.every(function (r) { return r.test(password || ''); });
  }

  // Show/hide toggle (eye icon) on a password input
  function attachToggle(inputId) {
    var input = document.getElementById(inputId);
    if (!input || input.dataset.hasToggle) return;
    input.dataset.hasToggle = '1';

    var wrap = document.createElement('div');
    wrap.style.position = 'relative';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.paddingRight = '44px';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    btn.style.cssText =
      'position:absolute;right:4px;top:50%;transform:translateY(-50%);' +
      'background:transparent;border:none;cursor:pointer;padding:8px 10px;' +
      'color:#617b99;font-size:0.9rem;line-height:1;';

    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    wrap.appendChild(btn);
  }

  // Live requirements checklist under a password input
  function attachChecklist(inputId) {
    var input = document.getElementById(inputId);
    if (!input || input.dataset.hasChecklist) return;
    input.dataset.hasChecklist = '1';

    var list = document.createElement('ul');
    list.style.cssText =
      'list-style:none;margin:8px 0 0;padding:0;font-size:0.8rem;line-height:1.9;';

    var items = RULES.map(function (rule) {
      var li = document.createElement('li');
      li.style.color = '#dc2626';
      li.innerHTML = '<span style="display:inline-block;width:16px;">\u2022</span>' + rule.label;
      list.appendChild(li);
      return { rule: rule, el: li };
    });

    function update() {
      var value = input.value || '';
      items.forEach(function (item) {
        var ok = item.rule.test(value);
        item.el.style.color = ok ? '#16a34a' : '#dc2626';
        item.el.innerHTML =
          '<span style="display:inline-block;width:16px;">' + (ok ? '\u2713' : '\u2022') + '</span>' +
          item.rule.label;
      });
    }

    input.addEventListener('input', update);
    update();

    // Insert after the input's wrapper (or the input itself)
    var anchor = input.dataset.hasToggle ? input.parentNode : input;
    anchor.parentNode.insertBefore(list, anchor.nextSibling);
  }

  window.PasswordUI = {
    rules: RULES,
    isValid: isValid,
    attachToggle: attachToggle,
    attachChecklist: attachChecklist,
  };
})();
