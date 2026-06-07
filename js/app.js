(function() {
  'use strict';

  var CONFIG = {
    botId: '7648605237338718250',
    apiToken: 'sat_XYf3UJR3nGWUnfn5qX6yCVx7AnAPyTiNYtQWDn1ikOJe9j6nYwoUGLb5SNSO5Zmm',
    apiUrl: 'https://m9jyy5369h.coze.site/stream_run'
  };

  var state = {
    currentPage: 'home',
    orders: JSON.parse(localStorage.getItem('lumguide_orders') || '[]'),
    sessionId: 'lum_' + Date.now().toString(36),
    isTyping: false
  };

  var $ = function(s) { return document.querySelector(s); };
  var $$ = function(s) { return document.querySelectorAll(s); };

  var pages = {
    home: { nav: ['nav-home'], title: 'LUMGUIDE' },
    chat: { nav: ['nav-chat'], title: 'AI Assistant' },
    submit: { nav: ['nav-submit'], title: 'New Sourcing Request' },
    orders: { nav: ['nav-orders'], title: 'My Orders' },
    about: { nav: ['nav-about'], title: 'About' }
  };

  function navigate(page) {
    if (!pages[page]) page = 'home';
    state.currentPage = page;
    $$('.page').forEach(function(el) { el.classList.remove('active'); });
    var target = $('#page-' + page);
    if (target) target.classList.add('active');
    var navIds = (pages[page] || {}).nav || [];
    $$('.nav-link, .mobile-nav-link').forEach(function(el) { el.classList.remove('active'); });
    navIds.forEach(function(id) { $$('.' + id).forEach(function(el) { el.classList.add('active'); }); });
    document.title = 'LUMGUIDE \u2014 ' + (pages[page] || {}).title || '';
    window.location.hash = '#' + page;
    window.scrollTo(0, 0);
  }

  function getPageFromHash() {
    var hash = window.location.hash.replace('#', '');
    return pages[hash] ? hash : 'home';
  }

  function showToast(msg) {
    var toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 2500);
  }

  function addMessage(role, text) {
    var container = $('#chat-messages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'chat-message ' + role;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function addTypingIndicator() {
    var container = $('#chat-messages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'chat-message bot';
    div.id = 'typing-indicator';
    div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTypingIndicator() {
    var el = $('#typing-indicator');
    if (el) el.remove();
  }

  function callCozeAPI(query, onChunk, onDone, onError) {
    var body = JSON.stringify({
      content: {
        query: {
          prompt: [{ type: 'text', content: { text: query } }]
        }
      },
      type: 'query',
      session_id: state.sessionId,
      project_id: parseInt(CONFIG.botId)
    });

    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.apiToken,
        'Content-Type': 'application/json'
      },
      body: body
    }).then(function(response) {
      if (!response.ok) {
        response.text().then(function(t) {
          onError(new Error('HTTP ' + response.status));
        });
        return;
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var accumulatedText = '';

      function processStream() {
        reader.read().then(function(result) {
          if (result.done) {
            onDone();
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.startsWith('data: ')) {
              try {
                var data = JSON.parse(line.substring(6));
                if (data.type === 'answer' && data.content) {
                  if (data.content.answer) {
                    accumulatedText += data.content.answer;
                    onChunk(accumulatedText);
                  }
                  if (data.finish) {
                    onDone();
                    return;
                  }
                }
              } catch(e) {}
            }
          }
          processStream();
        }).catch(function(err) {
          onError(err);
        });
      }
      processStream();
    }).catch(function(err) {
      onError(err);
    });
  }

  function handleChatSubmit(e) {
    if (e) e.preventDefault();
    var input = $('#chat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text || state.isTyping) return;

    addMessage('user', text);
    input.value = '';
    state.isTyping = true;
    addTypingIndicator();

    var botMsgDiv = null;

    callCozeAPI(text,
      function(fullText) {
        removeTypingIndicator();
        if (!botMsgDiv) {
          botMsgDiv = addMessage('bot', '');
        }
        botMsgDiv.textContent = fullText;
        var c = $('#chat-messages');
        if (c) c.scrollTop = c.scrollHeight;
      },
      function() {
        state.isTyping = false;
        removeTypingIndicator();
      },
      function(err) {
        state.isTyping = false;
        removeTypingIndicator();
        addMessage('bot', 'Sorry, I encountered an error. Please try again.');
      }
    );
  }

  function handleSubmitForm(e) {
    e.preventDefault();
    var form = e.target;
    var data = new FormData(form);
    var order = {
      id: 'ORD-' + Date.now().toString(36).toUpperCase(),
      date: new Date().toISOString(),
      status: 'pending',
      items: Object.fromEntries(data.entries())
    };
    state.orders.unshift(order);
    localStorage.setItem('lumguide_orders', JSON.stringify(state.orders));
    form.reset();
    showToast('Request submitted! We\'ll get back to you soon.');
    renderOrders();
  }

  function renderOrders() {
    var container = $('#orders-list');
    if (!container) return;
    if (state.orders.length === 0) {
      container.innerHTML = '<div class="orders-empty"><h3>No orders yet</h3><p>Submit a sourcing request to get started.</p></div>';
      return;
    }
    container.innerHTML = state.orders.map(function(o) {
      return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
        '<div style="color:var(--gold);font-weight:600;font-size:13px">' + o.id + '</div>' +
        (o.items.product_type ? '<div style="font-size:13px;color:var(--text-muted);margin-top:4px">Product: ' + o.items.product_type + '</div>' : '') +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">' + new Date(o.date).toLocaleDateString() + '</div></div>';
    }).join('');
  }

  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(function() {});
    }
    document.addEventListener('click', function(e) {
      var link = e.target.closest('[data-nav]');
      if (link) { e.preventDefault(); navigate(link.dataset.nav); }
    });
    window.addEventListener('hashchange', function() { navigate(getPageFromHash()); });
    var chatForm = $('#chat-form');
    if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);
    var submitForm = $('#submit-form');
    if (submitForm) submitForm.addEventListener('submit', handleSubmitForm);
    navigate(getPageFromHash());
    renderOrders();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
