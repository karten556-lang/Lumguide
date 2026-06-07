(function() {
  'use strict';

  // === Configuration ===
  var CONFIG = {
    botId: '7648605237338718250',
    apiToken: 'sat_XYf3UJR3nGWUnfn5qX6yCVx7AnAPyTiNYtQWDn1ikOJe9j6nYwoUGLb5SNSO5Zmm',
    apiUrl: 'https://m9jyy5369h.coze.site/stream_run'
  };

  // === State ===
  var state = {
    currentPage: 'home',
    orders: JSON.parse(localStorage.getItem('lumguide_orders') || '[]'),
    sessionId: 'lumguide_' + Date.now().toString(36),
    isTyping: false
  };

  // === DOM helpers ===
  var $ = function(s) { return document.querySelector(s); };
  var $$ = function(s) { return document.querySelectorAll(s); };

  var pages = {
    home: { nav: ['nav-home'], title: 'LUMGUIDE' },
    chat: { nav: ['nav-chat'], title: 'AI Assistant' },
    submit: { nav: ['nav-submit'], title: 'New Sourcing Request' },
    orders: { nav: ['nav-orders'], title: 'My Orders' },
    about: { nav: ['nav-about'], title: 'About' }
  };

  // === Navigation ===
  function navigate(page) {
    if (!pages[page]) page = 'home';
    state.currentPage = page;
    $$('.page').forEach(function(el) { el.classList.remove('active'); });
    var target = $('#page-' + page);
    if (target) target.classList.add('active');
    var navIds = (pages[page] || {}).nav || [];
    $$('.nav-link, .mobile-nav-link').forEach(function(el) { el.classList.remove('active'); });
    navIds.forEach(function(id) {
      $$('.' + id).forEach(function(el) { el.classList.add('active'); });
    });
    document.title = 'LUMGUIDE \u2014 ' + (pages[page] || {}).title || '';
    window.location.hash = '#' + page;
    window.scrollTo(0, 0);
  }

  function getPageFromHash() {
    var hash = window.location.hash.replace('#', '');
    return pages[hash] ? hash : 'home';
  }

  // === Toast ===
  function showToast(msg) {
    var toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 2500);
  }

  // === Chat UI ===
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

  // === Coze API Call ===
  function callCozeAPI(query, onChunk, onDone, onError) {
    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: {
          query: {
            prompt: [{
              type: 'text',
              content: { text: query }
            }]
          }
        },
        type: 'query',
        session_id: state.sessionId,
        project_id: parseInt(CONFIG.botId)
      })
    }).then(function(response) {
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function readChunk() {
        reader.read().then(function(result) {
          if (result.done) {
            if (onDone) onDone();
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
                if (data.type === 'answer' && data.content && data.content.answer) {
                  if (onChunk) onChunk(data.content.answer);
                }
                if (data.type === 'message_end' || data.finish) {
                  if (onDone) onDone();
                }
              } catch(e) {
                // skip malformed JSON
              }
            }
          }
          readChunk();
        }).catch(function(err) {
          if (onError) onError(err);
        });
      }
      readChunk();
    }).catch(function(err) {
      if (onError) onError(err);
    });
  }

  // === Chat Handler ===
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
    var accumulatedText = '';

    callCozeAPI(text,
      function(chunk) {
        accumulatedText += chunk;
        removeTypingIndicator();
        if (!botMsgDiv) {
          botMsgDiv = addMessage('bot', '');
        }
        botMsgDiv.textContent = accumulatedText;
      },
      function() {
        state.isTyping = false;
        removeTypingIndicator();
      },
      function(err) {
        state.isTyping = false;
        removeTypingIndicator();
        addMessage('bot', 'Sorry, I encountered an error. Please try again later.');
      }
    );
  }

  // === Submit Form ===
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

  // === Render Orders ===
  function renderOrders() {
    var container = $('#orders-list');
    if (!container) return;

    if (state.orders.length === 0) {
      container.innerHTML =
        '<div class="orders-empty">' +
          '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.4;margin-bottom:16px">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>' +
          '</svg>' +
          '<h3 style="font-size:18px;margin-bottom:8px;color:var(--text)">No orders yet</h3>' +
          '<p style="color:var(--text-muted)">Submit a sourcing request to get started.</p>' +
        '</div>';
      return;
    }

    container.innerHTML = state.orders.map(function(order) {
      var statusColor = order.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)';
      var statusText = order.status === 'pending' ? 'Under Review' : 'Done';
      return '<div class="order-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<span style="font-size:13px;font-weight:600;color:var(--gold)">' + order.id + '</span>' +
          '<span style="font-size:12px;padding:3px 10px;border-radius:20px;background:' + statusColor + ';color:var(--' + (order.status === 'pending' ? 'gold' : 'success') + ')">' + statusText + '</span>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--text-muted)">' +
          (order.items.product_type ? '<div>Product: ' + order.items.product_type + '</div>' : '') +
          (order.items.quantity ? '<div>Quantity: ' + order.items.quantity + '</div>' : '') +
          (order.items.description ? '<div style="margin-top:4px">' + order.items.description.substring(0, 80) + (order.items.description.length > 80 ? '...' : '') + '</div>' : '') +
          '<div style="margin-top:6px;font-size:11px">' + new Date(order.date).toLocaleDateString() + '</div>' +
        '</div></div>';
    }).join('');
  }

  // === Init ===
  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(function() {});
    }

    document.addEventListener('click', function(e) {
      var link = e.target.closest('[data-nav]');
      if (link) {
        e.preventDefault();
        navigate(link.dataset.nav);
      }
    });

    window.addEventListener('hashchange', function() {
      navigate(getPageFromHash());
    });

    var chatForm = $('#chat-form');
    if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);

    var submitForm = $('#submit-form');
    if (submitForm) submitForm.addEventListener('submit', handleSubmitForm);

    navigate(getPageFromHash());
    renderOrders();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
