(function() {
  'use strict';

  // State
  const state = {
    currentPage: 'home',
    messages: [],
    orders: JSON.parse(localStorage.getItem('lumguide_orders') || '[]'),
    user: JSON.parse(localStorage.getItem('lumguide_user') || 'null'),
    cozeBotId: localStorage.getItem('lumguide_coze_bot') || ''
  };

  // DOM refs
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const pages = {
    home: { nav: ['nav-home'], title: 'LUMGUIDE' },
    chat: { nav: ['nav-chat'], title: 'AI Assistant' },
    submit: { nav: ['nav-submit'], title: 'New Sourcing Request' },
    orders: { nav: ['nav-orders'], title: 'My Orders' },
    about: { nav: ['nav-about'], title: 'About' }
  };

  // Routing
  function navigate(page) {
    if (!pages[page]) page = 'home';
    state.currentPage = page;

    // Update pages
    $$('.page').forEach(el => el.classList.remove('active'));
    const target = $(`#page-${page}`);
    if (target) target.classList.add('active');

    // Update nav links
    $$('.nav-link, .mobile-nav-link').forEach(el => el.classList.remove('active'));
    (pages[page]?.nav || []).forEach(id => {
      $$(`.${id}`).forEach(el => el.classList.add('active'));
    });

    // Update document title
    document.title = `LUMGUIDE — ${pages[page]?.title || ''}`;

    // Save to hash
    window.location.hash = `#${page}`;

    // Scroll top
    window.scrollTo(0, 0);
  }

  function getPageFromHash() {
    const hash = window.location.hash.replace('#', '');
    return pages[hash] ? hash : 'home';
  }

  // Toast
  function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // Chat
  function addMessage(role, text) {
    const container = $('#chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = $('#chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-message bot';
    div.id = 'typing-indicator';
    div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = $('#typing-indicator');
    if (el) el.remove();
  }

  function getBotResponse(userMsg) {
    const lower = userMsg.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return "Hello! Welcome to LUMGUIDE. I'm your AI sourcing assistant. How can I help you find lighting products today?";
    }

    if (lower.includes('pendant') || lower.includes('chandelier') || lower.includes('ceiling') || lower.includes('lighting')) {
      return "Great, we can help with that! We work with top factories in Zhongshan specializing in pendant lights, chandeliers, ceiling lights, and more. To get started, could you tell me:\n\n1. Product type?\n2. Quantity?\n3. Target price per unit?\n4. Destination country?\n\nOr you can fill out a detailed request on our Submit page.";
    }

    if (lower.includes('moq') || lower.includes('minimum') || lower.includes('quantity')) {
      return "MOQ varies by product:\n• Stock models: 50-100 pieces\n• Custom designs: 200-500 pieces\n\nFor boutique buyers, we can sometimes negotiate lower MOQs. What quantity are you looking at?";
    }

    if (lower.includes('price') || lower.includes('cost') || lower.includes('budget') || lower.includes('quote')) {
      return "Pricing depends on specifications, quantity, and finishing requirements. Could you share more details on what you need? A typical pendant light can range from $8-35/piece depending on materials and complexity. For an accurate quote, please submit a detailed request.";
    }

    if (lower.includes('sample') || lower.includes('prototype')) {
      return "Yes, we offer sampling! Sample cost is typically production cost + shipping, and it's deductible from bulk orders. Lead time: 7-15 days. Just let us know which product you'd like a sample of!";
    }

    if (lower.includes('quality') || lower.includes('qc') || lower.includes('inspection')) {
      return "Quality is our priority. We provide multi-stage QC:\n1. Raw material inspection\n2. In-production checks\n3. Final AQL 2.5 random inspection\n4. Pre-shipment inspection\n\nWe also have our own workshop for assembly and quality verification.";
    }

    if (lower.includes('shipping') || lower.includes('delivery') || lower.includes('logistics') || lower.includes('lead time')) {
      return "Typical lead times:\n• Stock products: 15-25 days\n• Custom orders: 30-45 days (incl. sampling)\n\nWe arrange FOB (Chinese port), CIF (destination port), or door-to-door express (DHL/FedEx for small orders).";
    }

    if (lower.includes('certification') || lower.includes('ce') || lower.includes('ul') || lower.includes('rohs')) {
      return "Most of our products comply with CE, RoHS, and UL standards for relevant markets. We can arrange specific certifications upon request. Let me know what certifications your market requires!";
    }

    if (lower.includes('contact') || lower.includes('human') || lower.includes('person') || lower.includes('real')) {
      return "I'll make sure a real person follows up with you. In the meantime, feel free to submit a detailed request on our Submit page and our team will get back to you promptly!";
    }

    return "Thanks for your message! I'm here to help with all your lighting sourcing needs. For more detailed inquiries, please use the Submit page and our team will get back to you with a tailored solution. Or feel free to ask me anything about:\n\n• Product recommendations\n• MOQ and pricing\n• Quality control\n• Sampling process\n• Shipping and logistics";
  }

  function handleChatSubmit(e) {
    if (e) e.preventDefault();
    const input = $('#chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    addMessage('user', text);
    input.value = '';
    showTyping();

    setTimeout(() => {
      hideTyping();
      const response = getBotResponse(text);
      addMessage('bot', response);
    }, 800 + Math.random() * 600);
  }

  // Submit form
  function handleSubmitForm(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const order = {
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

  // Render orders
  function renderOrders() {
    const container = $('#orders-list');
    if (!container) return;

    if (state.orders.length === 0) {
      container.innerHTML = `
        <div class="orders-empty">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>
          </svg>
          <h3>No orders yet</h3>
          <p>Submit a sourcing request to get started.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.orders.map((order, i) => `
      <div class="order-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600;color:var(--gold)">${order.id}</span>
          <span style="font-size:12px;padding:3px 10px;border-radius:20px;
            background:${order.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)'};
            color:${order.status === 'pending' ? 'var(--gold)' : 'var(--success)'}">
            ${order.status === 'pending' ? 'Under Review' : 'Done'}
          </span>
        </div>
        <div style="font-size:13px;color:var(--text-muted)">
          ${order.items.product_type ? `<div>Product: ${order.items.product_type}</div>` : ''}
          ${order.items.quantity ? `<div>Quantity: ${order.items.quantity}</div>` : ''}
          ${order.items.product_type ? '' : ''}
          ${order.items.description ? `<div style="margin-top:4px">${order.items.description.substring(0,80)}${order.items.description.length > 80 ? '...' : ''}</div>` : ''}
          <div style="margin-top:6px;font-size:11px">${new Date(order.date).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');
  }

  // Coze bot embed config
  function setupCozeEmbed() {
    const container = $('#coze-embed-container');
    const placeholder = $('#coze-placeholder');

    if (state.cozeBotId) {
      // User has configured a Coze bot
      if (placeholder) placeholder.classList.add('hidden');
      // Create iframe or script embed
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.coze.cn/space/bot/${state.cozeBotId}`;
      iframe.className = 'coze-embed active';
      iframe.allow = 'clipboard-read; clipboard-write';
      container.appendChild(iframe);
    }
  }

  // Init
  function init() {
    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }

    // Navigation
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-nav]');
      if (link) {
        e.preventDefault();
        navigate(link.dataset.nav);
      }
    });

    // Hash change
    window.addEventListener('hashchange', () => navigate(getPageFromHash()));

    // Chat
    const chatForm = $('#chat-form');
    if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);

    // Submit form
    const submitForm = $('#submit-form');
    if (submitForm) submitForm.addEventListener('submit', handleSubmitForm);

    // Initial page
    navigate(getPageFromHash());

    // Render orders
    renderOrders();

    // Coze embed
    setupCozeEmbed();

    // Welcome message
    setTimeout(() => {
      addMessage('bot', "👋 Hi! I'm your LUMGUIDE AI assistant. I can help you find the right lighting products, check pricing, MOQ, and connect you with top factories in Zhongshan. How can I help you today?");
    }, 500);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
